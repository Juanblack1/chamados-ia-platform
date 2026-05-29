import { describe, expect, it } from "vitest";
import { AgentOrchestrator } from "../src/ai/agents/AgentOrchestrator.js";
import { ResolutionDraftAgent } from "../src/ai/agents/ResolutionDraftAgent.js";
import { TicketSpecialistChatAgent } from "../src/ai/agents/TicketSpecialistChatAgent.js";
import { TicketTriageAgent } from "../src/ai/agents/TicketTriageAgent.js";
import { ModelGateway } from "../src/ai/modelGateway.js";
import { QdrantKnowledgeBase } from "../src/ai/rag/QdrantKnowledgeBase.js";
import type { AppEnv } from "../src/config/env.js";
import { DomainEventBus } from "../src/domain/events.js";
import { TicketRepository } from "../src/domain/ticketRepository.js";
import { AuditLog } from "../src/observability/auditLog.js";
import { TraceRecorder } from "../src/observability/traces.js";
import { normalizeCreateTicketInput } from "../src/domain/ticket.js";

const env: AppEnv = {
  NODE_ENV: "test",
  PORT: 4000,
  FRONTEND_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "silent",
  API_KEYS: "",
  AI_PROVIDER: "mock",
  GOOGLE_GENERATIVE_AI_API_KEY: "",
  GOOGLE_GENERATIVE_AI_MODEL: "gemini-2.5-flash",
  GOOGLE_GENERATIVE_AI_FALLBACK_MODELS: "gemini-2.5-flash-lite,gemini-2.0-flash",
  GOOGLE_EMBEDDING_MODEL: "gemini-embedding-001",
  EMBEDDING_DIMENSION: 64,
  AUTH_COOKIE_NAME: "asid",
  AUTH_SESSION_TTL_SECONDS: 28800,
  AUTH_BOOTSTRAP_ADMIN_EMAIL: "admin@empresa.local",
  AUTH_BOOTSTRAP_ADMIN_PASSWORD: "",
  AUTH_TEST_REQUESTER_EMAIL: "solicitante.teste@empresa.local",
  AUTH_TEST_REQUESTER_PASSWORD: "",
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
      new TicketSpecialistChatAgent(llm),
      new DomainEventBus(),
      new AuditLog(),
      traces
    );

    const payload = normalizeCreateTicketInput({
      requesterEmail: "ana@acme.local",
      department: "Financeiro",
      title: "Faturamento bloqueado no ERP",
      description:
        "O lote de faturamento do ERP falhou e o fechamento fiscal da filial esta bloqueado desde 09:00.",
      affectedService: "ERP Central",
      urgency: "critical",
      impact: "critical",
      businessImpact: "Fechamento mensal parado para a filial SP.",
      attachments: []
    });
    const assessment = await orchestrator.assessIntake(payload);
    expect(assessment.shouldCreate).toBe(true);
    expect(assessment.qualityScore).toBeGreaterThanOrEqual(50);
    expect(assessment.ragSources.length).toBeGreaterThan(0);
    expect(assessment.workflow).toEqual(expect.arrayContaining(["agent.intake-quality", "agent.rag-retrieval"]));

    const ticket = await orchestrator.openTicket(payload, {}, undefined, assessment);

    expect(ticket.number).toMatch(/^INC-/);
    expect(ticket.priority).toBe("critical");
    expect(ticket.ai.triage?.confidence).toBeGreaterThan(0);
    expect(ticket.ai.retrievedSources.length).toBeGreaterThan(0);
    expect(ticket.ai.triage?.metadata?.traceId).toBeTruthy();
    expect(traces.list().map((span) => span.name)).toEqual(
      expect.arrayContaining([
        "ticket.open",
        "agent.intake-quality",
        "agent.rag-retrieval",
        "rag.search",
        "agent.ticket-triage",
        "agent.routing",
        "agent.sla-risk",
        "agent.resolution-draft"
      ])
    );
    expect(ticket.ai.agentMemory?.some((entry) => entry.agent === "intake-quality")).toBe(true);
    expect(ticket.ai.agentMemory?.some((entry) => entry.agent === "rag-retrieval")).toBe(true);
    expect(ticket.ai.agentMemory?.some((entry) => entry.agent === "routing")).toBe(true);
    expect(ticket.ai.agentMemory?.some((entry) => entry.agent === "sla-risk")).toBe(true);
    const platformAgents = orchestrator.describeAiPlatform("agents") as { agents: Array<{ id: string }> };
    expect(platformAgents.agents.map((agent) => agent.id)).toEqual(
      expect.arrayContaining(["intake-quality", "ticket-triage", "rag-retrieval", "routing", "resolution-drafter", "sla-risk", "ticket-specialist"])
    );
    await expect(orchestrator.searchKnowledge("VPN desconectando com perda de pacote", 2)).resolves.toHaveLength(2);

    const chatted = await orchestrator.chatWithTicket(
      ticket.id,
      {
        id: "admin-1",
        email: "admin@empresa.local",
        name: "Admin",
        role: "admin",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: [],
        active: true
      },
      "Quais proximos passos devo tomar neste chamado?"
    );
    expect(chatted?.ai.agentMemory?.some((entry) => entry.agent === "ticket-specialist" && entry.role === "assistant")).toBe(true);
    expect(chatted?.ai.agentMemory?.at(-1)?.contextTicketIds?.length).toBeGreaterThan(0);

    const streamEvents = [];
    for await (const event of orchestrator.streamChatWithTicket(
      ticket.id,
      {
        id: "admin-1",
        email: "admin@empresa.local",
        name: "Admin",
        role: "admin",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: [],
        active: true
      },
      "Resuma o andamento em streaming."
    )) {
      streamEvents.push(event);
    }
    expect(streamEvents.some((event) => event.type === "status")).toBe(true);
    expect(streamEvents.some((event) => event.type === "delta")).toBe(true);
    expect(streamEvents.at(-1)?.type).toBe("ticket");

    const deletedByRequester = await orchestrator.deleteTicket(ticket.id, {
      id: "requester-1",
      email: "ana@acme.local",
      name: "Ana",
      role: "requester",
      entityId: "corp",
      entityName: "Corporativo",
      groupIds: [],
      active: true
    });
    expect(deletedByRequester).toBe(false);

    const deletedByAdmin = await orchestrator.deleteTicket(ticket.id, {
      id: "admin-1",
      email: "admin@empresa.local",
      name: "Admin",
      role: "admin",
      entityId: "corp",
      entityName: "Corporativo",
      groupIds: [],
      active: true
    });
    expect(deletedByAdmin).toBe(true);
    await expect(orchestrator.findTicket(ticket.id)).resolves.toBeUndefined();
  });

  it("blocks vague intake before a meaningless ticket is created", async () => {
    const llm = new ModelGateway(env);
    const orchestrator = new AgentOrchestrator(
      new TicketRepository(),
      new QdrantKnowledgeBase(env, llm),
      new TicketTriageAgent(llm),
      new ResolutionDraftAgent(llm),
      new TicketSpecialistChatAgent(llm),
      new DomainEventBus(),
      new AuditLog(),
      new TraceRecorder()
    );

    const assessment = await orchestrator.assessIntake(
      normalizeCreateTicketInput({
        requesterEmail: "ana@acme.local",
        department: "Operacoes",
        title: "Problema urgente",
        description: "Nao funciona. Preciso de ajuda porque esta ruim.",
        affectedService: "Geral",
        urgency: "medium",
        impact: "medium",
        businessImpact: "Nao sei.",
        attachments: []
      })
    );

    expect(assessment.shouldCreate).toBe(false);
    expect(assessment.readiness).toBe("needs_info");
    expect(assessment.missingInformation.length).toBeGreaterThan(0);

    const genericButLongAssessment = await orchestrator.assessIntake(
      normalizeCreateTicketInput({
        requesterEmail: "ana@acme.local",
        department: "Operacoes",
        title: "Problema urgente sem detalhes",
        description: "Nao funciona direito desde ontem e preciso de ajuda urgente, mas nao sei explicar melhor.",
        affectedService: "Nao sei",
        urgency: "medium",
        impact: "medium",
        businessImpact: "Preciso de ajuda, mas ainda nao informei impacto operacional concreto.",
        attachments: []
      })
    );

    expect(genericButLongAssessment.shouldCreate).toBe(false);
    expect(genericButLongAssessment.readiness).toBe("needs_info");
    expect(genericButLongAssessment.missingInformation).toEqual(
      expect.arrayContaining(["Informe o sistema, aplicacao ou servico afetado."])
    );
    await expect(orchestrator.listTickets()).resolves.toHaveLength(2);
  });
});
