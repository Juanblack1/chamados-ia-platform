import { createHash } from "node:crypto";
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from "@ai-sdk/google";
import { createXai, type XaiProvider } from "@ai-sdk/xai";
import { embedMany, generateText, Output, streamText as streamAiText, type LanguageModel } from "ai";
import type { z } from "zod";
import type { AppEnv } from "../config/env.js";

export type JsonFallback<T> = () => T;
type ModelProvider = "google" | "xai";
type ModelTarget = {
  provider: ModelProvider;
  modelId: string;
  label: string;
};

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
  private readonly googleProvider: GoogleGenerativeAIProvider;
  private readonly xaiProvider: XaiProvider;
  private readonly textModelTargets: ModelTarget[];

  constructor(private readonly env: AppEnv) {
    this.googleProvider = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY || undefined
    });
    this.xaiProvider = createXai({
      apiKey: env.XAI_API_KEY || undefined
    });
    this.textModelTargets = buildTextModelTargets(env);
  }

  get isConfigured(): boolean {
    return this.env.AI_PROVIDER !== "mock" && this.env.NODE_ENV !== "test" && this.textModelTargets.length > 0;
  }

  languageModel(target = this.defaultTextModelTarget()): LanguageModel {
    if (target.provider === "xai") return this.xaiProvider(target.modelId);
    return this.googleProvider(target.modelId);
  }

  get modelCascade(): string[] {
    return this.textModelTargets.map((target) => target.label);
  }

  get routeLabel(): string {
    return this.isConfigured ? this.modelCascade.join(" > ") : "local-fallback";
  }

  get executionMode(): "model-cascade" | "deterministic-fallback" {
    return this.isConfigured ? "model-cascade" : "deterministic-fallback";
  }

  async completeObject<T>(params: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    fallback: JsonFallback<T>;
  }): Promise<T> {
    if (!this.isConfigured) return params.fallback();

    for (const target of this.textModelTargets) {
      try {
        const { output } = await generateText({
          model: this.languageModel(target),
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

    for (const target of this.textModelTargets) {
      try {
        const { text } = await generateText({
          model: this.languageModel(target),
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

    for (const target of this.textModelTargets) {
      let emittedText = "";
      yield {
        type: "status",
        phase: "model",
        model: target.label,
        message: `Consultando ${target.label}.`
      };

      try {
        const result = streamAiText({
          model: this.languageModel(target),
          system: params.system,
          prompt: params.user,
          maxRetries: 0
        });

        for await (const delta of result.textStream) {
          emittedText += delta;
          yield { type: "delta", text: delta, model: target.label };
        }

        if (emittedText.trim()) {
          yield { type: "status", phase: "done", model: target.label, message: "Resposta concluida." };
          return;
        }

        yield {
          type: "error",
          model: target.label,
          message: `${target.label} nao retornou conteudo util.`
        };
      } catch (cause) {
        yield {
          type: "error",
          model: target.label,
          message: `${target.label} falhou: ${safeErrorMessage(cause)}`
        };
      }

      yield {
        type: "status",
        phase: "fallback",
        model: target.label,
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
    if (!this.isGoogleEmbeddingConfigured) {
      return texts.map((text) => deterministicEmbedding(text, this.env.EMBEDDING_DIMENSION));
    }

    const response = await embedMany({
      model: this.googleProvider.embedding(this.env.GOOGLE_EMBEDDING_MODEL),
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

  private get isGoogleEmbeddingConfigured(): boolean {
    return this.env.AI_PROVIDER !== "mock" && this.env.NODE_ENV !== "test" && Boolean(this.env.GOOGLE_GENERATIVE_AI_API_KEY);
  }

  private defaultTextModelTarget(): ModelTarget {
    return {
      provider: "google",
      modelId: this.env.GOOGLE_GENERATIVE_AI_MODEL,
      label: `google:${this.env.GOOGLE_GENERATIVE_AI_MODEL}`
    };
  }
}

function buildTextModelTargets(env: AppEnv): ModelTarget[] {
  if (env.AI_PROVIDER === "mock") return [];

  const googleTargets = splitCsv([env.GOOGLE_GENERATIVE_AI_MODEL, env.GOOGLE_GENERATIVE_AI_FALLBACK_MODELS].join(",")).map(
    (modelId) => ({
      provider: "google" as const,
      modelId,
      label: `google:${modelId}`
    })
  );
  const xaiTargets = splitCsv(env.XAI_MODEL_CASCADE).map((modelId) => ({
    provider: "xai" as const,
    modelId,
    label: `xai:${modelId}`
  }));

  const orderedTargets = env.AI_PROVIDER === "xai" ? [...xaiTargets, ...googleTargets] : [...googleTargets, ...xaiTargets];
  return dedupeTargets(orderedTargets).filter((target) => hasProviderCredentials(env, target.provider));
}

function hasProviderCredentials(env: AppEnv, provider: ModelProvider): boolean {
  if (provider === "xai") return Boolean(env.XAI_API_KEY);
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY);
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

function dedupeTargets(values: ModelTarget[]): ModelTarget[] {
  const seen = new Set<string>();
  return values.filter((target) => {
    if (seen.has(target.label)) return false;
    seen.add(target.label);
    return true;
  });
}

function splitCsv(value: string): string[] {
  return dedupe(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function safeErrorMessage(cause: unknown): string {
  if (!(cause instanceof Error)) return "erro desconhecido";
  const message = cause.message.trim();
  if (!message) return "erro desconhecido";
  return message.length > 160 ? `${message.slice(0, 157)}...` : message;
}
