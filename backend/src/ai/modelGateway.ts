import { createHash } from "node:crypto";
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from "@ai-sdk/google";
import { embedMany, generateText, Output, streamText as streamAiText, type LanguageModel } from "ai";
import type { z } from "zod";
import type { AppEnv } from "../config/env.js";

export type JsonFallback<T> = () => T;

export type ModelStreamEvent =
  | {
      type: "status";
      phase: "thinking" | "model" | "fallback" | "done";
      message: string;
      model?: string;
    }
  | {
      type: "delta";
      text: string;
      model: string;
    }
  | {
      type: "error";
      message: string;
      model?: string;
    };

export class ModelGateway {
  private readonly provider: GoogleGenerativeAIProvider;
  private readonly textModelIds: string[];

  constructor(private readonly env: AppEnv) {
    this.provider = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY || undefined
    });
    this.textModelIds = dedupe([
      env.GOOGLE_GENERATIVE_AI_MODEL,
      ...env.GOOGLE_GENERATIVE_AI_FALLBACK_MODELS.split(",").map((model) => model.trim())
    ]);
  }

  get isConfigured(): boolean {
    return this.env.AI_PROVIDER === "google" && this.env.NODE_ENV !== "test" && Boolean(this.env.GOOGLE_GENERATIVE_AI_API_KEY);
  }

  languageModel(modelId = this.textModelIds[0] ?? this.env.GOOGLE_GENERATIVE_AI_MODEL): LanguageModel {
    return this.provider(modelId);
  }

  get modelCascade(): string[] {
    return [...this.textModelIds];
  }

  async completeObject<T>(params: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    fallback: JsonFallback<T>;
  }): Promise<T> {
    if (!this.isConfigured) return params.fallback();

    for (const modelId of this.textModelIds) {
      try {
        const { output } = await generateText({
          model: this.languageModel(modelId),
          system: params.system,
          prompt: params.user,
          output: Output.object({ schema: params.schema }),
          maxRetries: 0
        });

        return output;
      } catch {
        continue;
      }
    }

    return params.fallback();
  }

  async completeText(params: { system: string; user: string; fallback: JsonFallback<string> }): Promise<string> {
    if (!this.isConfigured) return params.fallback();

    for (const modelId of this.textModelIds) {
      try {
        const { text } = await generateText({
          model: this.languageModel(modelId),
          system: params.system,
          prompt: params.user,
          maxRetries: 0
        });

        const trimmed = text.trim();
        if (trimmed) return trimmed;
      } catch {
        continue;
      }
    }

    return params.fallback();
  }

  async *streamText(params: { system: string; user: string; fallback: JsonFallback<string> }): AsyncGenerator<ModelStreamEvent> {
    yield {
      type: "status",
      phase: "thinking",
      message: "Preparando contexto, memoria e RAG para o agente especialista."
    };

    if (!this.isConfigured) {
      const fallback = params.fallback();
      yield {
        type: "status",
        phase: "fallback",
        message: "Modelo externo indisponivel; usando resposta deterministica local."
      };
      yield { type: "delta", text: fallback, model: "local-fallback" };
      yield { type: "status", phase: "done", message: "Resposta concluida.", model: "local-fallback" };
      return;
    }

    for (const modelId of this.textModelIds) {
      let emittedText = "";
      yield {
        type: "status",
        phase: "model",
        model: modelId,
        message: `Consultando ${modelId}.`
      };

      try {
        const result = streamAiText({
          model: this.languageModel(modelId),
          system: params.system,
          prompt: params.user,
          maxRetries: 0
        });

        for await (const delta of result.textStream) {
          emittedText += delta;
          yield { type: "delta", text: delta, model: modelId };
        }

        if (emittedText.trim()) {
          yield { type: "status", phase: "done", model: modelId, message: "Resposta concluida." };
          return;
        }

        yield {
          type: "error",
          model: modelId,
          message: `${modelId} nao retornou conteudo util.`
        };
      } catch (cause) {
        yield {
          type: "error",
          model: modelId,
          message: `${modelId} falhou: ${safeErrorMessage(cause)}`
        };
      }

      yield {
        type: "status",
        phase: "fallback",
        model: modelId,
        message: "Alternando para o proximo modelo da cascata."
      };
    }

    const fallback = params.fallback();
    yield {
      type: "status",
      phase: "fallback",
      message: "Todos os modelos falharam; usando resposta deterministica local."
    };
    yield { type: "delta", text: fallback, model: "local-fallback" };
    yield { type: "status", phase: "done", message: "Resposta concluida.", model: "local-fallback" };
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

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function safeErrorMessage(cause: unknown): string {
  if (!(cause instanceof Error)) return "erro desconhecido";
  const message = cause.message.trim();
  if (!message) return "erro desconhecido";
  return message.length > 160 ? `${message.slice(0, 157)}...` : message;
}
