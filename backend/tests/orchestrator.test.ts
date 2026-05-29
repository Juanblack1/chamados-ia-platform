import { describe, expect, it } from "vitest";
import { AgentOrchestrator } from "../src/ai/agents/AgentOrchestrator.js";
import { ResolutionDraftAgent } from "../src/ai/agents/ResolutionDraftAgent.js";
import { TicketTriageAgent } from "../src/ai/agents/TicketTriageAgent.js";
import { ModelGateway } from "../src/ai/modelGateway.js";
import { QdrantKnowledgeBase } from "../src/ai/rag/QdrantKnowledgeBase.js";
import type { AppEnv } from "../src/config/env.js";
import { DomainEventBus } from "../src/domain/events.js";
import { TicketRepository } from "../src/domain/ticketRepository.js";
import { AuditLog } from "../src/observability/auditLog.js";
import { TraceRecorder } from "../src/observability/traces.js";

const env: AppEnv = {
  NODE_ENV: "test",
  PORT: 4000,
  FRONTEND_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "silent",
  API_KEYS: "",
  AI_PROVIDER: "mock",
  GOOGLE_GENERATIVE_AI_API_KEY: "",
  GOOGLE_GENERATIVE_AI_MODEL: "gemini-2.5-flash",
  GOOGLE_EMBEDDING_MODEL: "gemini-embedding-001",
  EMBEDDING_DIMENSION: 64,
  AUTH_COOKIE_NAME: "asid",
  AUTH_SESSION_TTL_SECONDS: 28800,
  AUTH_BOOTSTRAP_ADMIN_EMAIL: "admin@empresa.local",
  AUTH_BOOTSTRAP_ADMIN_PASSWORD: "",
  TICKET_STORAGE: "memory",
  TICKET_REDIS_PREFIX: "ai-service-desk-test",
  TICKET_SEED_SAMPLE_DATA: false,
  KV_REST_API_URL: "",
  KV_REST_API_TOKEN: "",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  QDRANT_URL: "http://localhost:6333",
  QDRANT_API_KEY: "",
  QDRANT_COLLECTION: "service_desk_knowledge_test"
};

describe("AgentOrchestrator", () => {
  it("opens and triages a ticket without external LLM credentials", async () => {
    const llm = new ModelGateway(env);
    const traces = new TraceRecorder();
    const orchestrator = new AgentOrchestrator(
      new TicketRepository(),
      new QdrantKnowledgeBase(env, llm),
      new TicketTriageAgent(llm),
      new ResolutionDraftAgent(llm),
      new DomainEventBus(),
      new AuditLog(),
      traces
    );

    const ticket = await orchestrator.openTicket({
      requesterEmail: "ana@acme.local",
      department: "Financeiro",
      title: "Faturamento bloqueado no ERP",
      description:
        "O lote de faturamento do ERP falhou e o fechamento fiscal da filial esta bloqueado desde 09:00.",
      affectedService: "ERP Central",
      urgency: "critical",
      businessImpact: "Fechamento mensal parado para a filial SP.",
      attachments: []
    });

    expect(ticket.number).toMatch(/^INC-/);
    expect(ticket.priority).toBe("critical");
    expect(ticket.ai.triage?.confidence).toBeGreaterThan(0);
    expect(ticket.ai.retrievedSources.length).toBeGreaterThan(0);
    expect(ticket.ai.triage?.metadata?.traceId).toBeTruthy();
    expect(traces.list().map((span) => span.name)).toEqual(
      expect.arrayContaining(["ticket.open", "rag.search", "agent.ticket-triage", "agent.resolution-draft"])
    );
  });
});
