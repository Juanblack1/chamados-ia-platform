import { createHash } from "node:crypto";
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from "@ai-sdk/google";
import { embedMany, generateText, Output, type LanguageModel } from "ai";
import type { z } from "zod";
import type { AppEnv } from "../config/env.js";

export type JsonFallback<T> = () => T;

export class ModelGateway {
  private readonly provider: GoogleGenerativeAIProvider;

  constructor(private readonly env: AppEnv) {
    this.provider = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY || undefined
    });
  }

  get isConfigured(): boolean {
    return this.env.AI_PROVIDER === "google" && this.env.NODE_ENV !== "test" && Boolean(this.env.GOOGLE_GENERATIVE_AI_API_KEY);
  }

  languageModel(): LanguageModel {
    return this.provider(this.env.GOOGLE_GENERATIVE_AI_MODEL);
  }

  async completeObject<T>(params: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    fallback: JsonFallback<T>;
  }): Promise<T> {
    if (!this.isConfigured) return params.fallback();

    const { output } = await generateText({
      model: this.languageModel(),
      system: params.system,
      prompt: params.user,
      output: Output.object({ schema: params.schema })
    });

    return output;
  }

  async completeText(params: { system: string; user: string; fallback: JsonFallback<string> }): Promise<string> {
    if (!this.isConfigured) return params.fallback();

    const { text } = await generateText({
      model: this.languageModel(),
      system: params.system,
      prompt: params.user
    });

    return text.trim() || params.fallback();
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured) {
      return texts.map((text) => deterministicEmbedding(text, this.env.EMBEDDING_DIMENSION));
    }

    const response = await embedMany({
      model: this.provider.embedding(this.env.GOOGLE_EMBEDDING_MODEL),
      values: texts,
      providerOptions: {
        google: {
          outputDimensionality: this.env.EMBEDDING_DIMENSION,
          taskType: "SEMANTIC_SIMILARITY"
        }
      }
    });

    return response.embeddings;
  }
}

function deterministicEmbedding(text: string, dimensions: number): number[] {
  const vector: number[] = [];
  let salt = 0;

  while (vector.length < dimensions) {
    const hash = createHash("sha256").update(`${text}:${salt++}`).digest();
    for (const byte of hash) {
      vector.push(byte / 255);
      if (vector.length === dimensions) break;
    }
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}
