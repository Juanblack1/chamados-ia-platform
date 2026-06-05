import { z } from "zod";
import { loadEnv, type AppEnv } from "../../config/env.js";
import { createTicketStore } from "../../domain/ticketStore.js";
import type { TicketStore } from "../../domain/ticketRepository.js";
import { ModelGateway } from "../modelGateway.js";
import { describeAiServiceDeskPlatform, type AiPlatformFocus } from "../platformConfig.js";
import { QdrantKnowledgeBase } from "../rag/QdrantKnowledgeBase.js";
import { createTicketDatabaseTool } from "./ticketDatabaseTool.js";
import { defineServiceDeskTool, type ServiceDeskTool } from "./typedMastraPrimitives.js";

export const AiPlatformFocusSchema = z
  .enum(["all", "agents", "rag", "workflow", "tool_calls", "observability", "deployment"])
  .default("all");

export const RagSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  excerpt: z.string(),
  relevance: z.number()
});

export const KnowledgeSearchInputSchema = z.object({
  query: z.string().trim().min(3).max(500),
  limit: z.number().int().min(1).max(8).default(4)
});

export const KnowledgeSearchResultSchema = z.object({
  query: z.string(),
  count: z.number().int().nonnegative(),
  sources: z.array(RagSourceSchema),
  vectorStore: z.literal("Qdrant"),
  collection: z.string(),
  fallback: z.string()
});

const PlatformDescriptionSchema = z.object({
  focus: AiPlatformFocusSchema,
  platform: z.unknown()
});

type KnowledgeRuntime = {
  env: AppEnv;
  llm: ModelGateway;
  knowledge: QdrantKnowledgeBase;
};

let knowledgeRuntime: KnowledgeRuntime | undefined;
let ticketStorePromise: Promise<TicketStore> | undefined;

const DescribeAiServiceDeskInputSchema = z.object({
  focus: AiPlatformFocusSchema
});

export const describeAiServiceDeskTool = defineServiceDeskTool({
  id: "describe-ai-service-desk",
  description:
    "Describe the Service Desk IA platform architecture, Mastra agents, RAG, workflows, tool calls, observability, and deployment assets.",
  inputSchema: DescribeAiServiceDeskInputSchema,
  outputSchema: PlatformDescriptionSchema,
  mcp: {
    annotations: {
      title: "Describe Service Desk IA Platform",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  execute: async (input) => {
    const { focus } = DescribeAiServiceDeskInputSchema.parse(input);
    return {
      focus,
      platform: describeAiServiceDeskPlatform(focus as AiPlatformFocus)
    };
  }
});

export const searchServiceDeskKnowledgeTool = defineServiceDeskTool({
  id: "search-service-desk-knowledge",
  description:
    "Search approved service desk knowledge in Qdrant with deterministic local fallback. Use this before answering about policies, runbooks, SLA classification, access reset, VPN, ERP, or support procedures.",
  inputSchema: KnowledgeSearchInputSchema,
  outputSchema: KnowledgeSearchResultSchema,
  mcp: {
    annotations: {
      title: "Search Service Desk Knowledge",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  execute: async (input) => {
    const { query, limit } = KnowledgeSearchInputSchema.parse(input);
    const runtime = getKnowledgeRuntime();
    const sources = await runtime.knowledge.search(query, limit);

    return {
      query,
      count: sources.length,
      sources,
      vectorStore: "Qdrant" as const,
      collection: runtime.env.QDRANT_COLLECTION,
      fallback: "Local knowledgeSeed lexical scoring is used when Qdrant or embeddings are unavailable."
    };
  }
});

export const queryServiceDeskDatabaseTool = createTicketDatabaseTool(getMastraTicketStore);

export const serviceDeskTools: Record<string, ServiceDeskTool> = {
  describeAiServiceDesk: describeAiServiceDeskTool,
  searchServiceDeskKnowledge: searchServiceDeskKnowledgeTool,
  queryServiceDeskDatabase: queryServiceDeskDatabaseTool
};

function getKnowledgeRuntime(): KnowledgeRuntime {
  if (!knowledgeRuntime) {
    const env = loadEnv();
    const llm = new ModelGateway(env);
    knowledgeRuntime = {
      env,
      llm,
      knowledge: new QdrantKnowledgeBase(env, llm)
    };
  }

  return knowledgeRuntime;
}

function getMastraTicketStore(): Promise<TicketStore> {
  ticketStorePromise ??= createTicketStore(loadEnv());
  return ticketStorePromise;
}
