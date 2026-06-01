import { randomUUID } from "node:crypto";
import { buildSla, selectGroup } from "../../domain/serviceDeskCatalog.js";
import type { CreateTicketInput, RagSource, Ticket, TicketAgentMemoryEntry, TicketFollowup, TicketStatus, TicketTask } from "../../domain/ticket.js";
import { DomainEventBus } from "../../domain/events.js";
import { canAccessTicket, canWorkTicket } from "../../domain/ticketAccess.js";
import type { TicketStore } from "../../domain/ticketRepository.js";
import { AuditLog } from "../../observability/auditLog.js";
import { TraceRecorder } from "../../observability/traces.js";
import { hasPermission, type AppUser } from "../../security/authStore.js";
import { describeAiServiceDeskPlatform, type AiPlatformFocus } from "../platformConfig.js";
import { queryTicketDatabase, type TicketDatabaseQuery, type TicketDatabaseResult } from "../mastra/ticketDatabaseTool.js";
import { QdrantKnowledgeBase } from "../rag/QdrantKnowledgeBase.js";
import { assessTicketIntakeQuality, type IntakeAssessment } from "./IntakeQualityAgent.js";
import { ResolutionDraftAgent } from "./ResolutionDraftAgent.js";
import { TicketSpecialistChatAgent } from "./TicketSpecialistChatAgent.js";
import { TicketTriageAgent, type TriageResult } from "./TicketTriageAgent.js";

export type TraceLink = {
  traceId?: string;
  parentSpanId?: string;
};

export type TriagePreview = {
  triage: TriageResult;
  sources: RagSource[];
};

export type TicketChatStreamEvent =
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
    }
  | {
      type: "ticket";
      ticket: Ticket;
      messages: TicketAgentMemoryEntry[];
    };

type RoutingDecision = {
  groupId: string;
  groupName: string;
  summary: string;
};

type SlaRiskDecision = {
  risk: "normal" | "watch" | "escalate";
  riskTag: string;
  requiresHumanApproval: boolean;
  summary: string;
};

export class AgentOrchestrator {
  constructor(
    private readonly tickets: TicketStore,
    private readonly knowledge: QdrantKnowledgeBase,
    private readonly triageAgent: TicketTriageAgent,
    private readonly resolutionAgent: ResolutionDraftAgent,
    private readonly specialistAgent: TicketSpecialistChatAgent,
    private readonly events: DomainEventBus,
    private readonly auditLog: AuditLog,
    private readonly traces: TraceRecorder
  ) {
    this.events.onAny((event) => this.auditLog.record(event));
  }

  listTickets(): Promise<Ticket[]> {
    return this.tickets.list();
  }

  async listTicketsForUser(user: AppUser): Promise<Ticket[]> {
    const tickets = await this.tickets.list();
    return tickets.filter((ticket) => canAccessTicket(ticket, user));
  }

  findTicket(id: string): Promise<Ticket | undefined> {
    return this.tickets.findById(id);
  }

  async findTicketForUser(id: string, user: AppUser): Promise<Ticket | undefined> {
    const ticket = await this.tickets.findById(id);
    return ticket && canAccessTicket(ticket, user) ? ticket : undefined;
  }

  listAuditEvents() {
    return this.auditLog.list();
  }

  describeAiPlatform(focus: AiPlatformFocus = "all") {
    return describeAiServiceDeskPlatform(focus);
  }

  async searchKnowledge(query: string, limit = 4, traceLink: TraceLink = {}): Promise<RagSource[]> {
    const traceId = traceLink.traceId ?? randomUUID();
    return this.traces.runSpan(
      {
        traceId,
        parentSpanId: traceLink.parentSpanId,
        name: "rag.search",
        kind: "rag",
        inputSummary: query.slice(0, 120),
        metadata: { collection: "service_desk_knowledge", limit },
        summarizeOutput: (items) => `${items.length} sources`
      },
      () => this.knowledge.search(query, limit)
    );
  }

  queryTicketDatabaseForUser(user: AppUser | undefined, query: TicketDatabaseQuery): Promise<TicketDatabaseResult> {
    return queryTicketDatabase(this.tickets, user, query);
  }

  async assessIntake(input: CreateTicketInput, traceLink: TraceLink = {}, actor?: AppUser): Promise<IntakeAssessment> {
    const traceId = traceLink.traceId ?? randomUUID();
    return this.traces.runSpan<IntakeAssessment>(
      {
        traceId,
        parentSpanId: traceLink.parentSpanId,
        name: "ticket.intake-assessment",
        kind: "workflow",
        inputSummary: `${input.title} / ${input.affectedService}`,
        summarizeOutput: (assessment) => `${assessment.readiness} ${assessment.qualityScore}/100`
      },
      async ({ spanId }) => {
        const query = `${input.title}\n${input.description}\n${input.businessImpact}`;
        const sources = await this.traces.runSpan<RagSource[]>(
          {
            traceId,
            parentSpanId: spanId,
            name: "agent.rag-retrieval",
            kind: "agent",
            inputSummary: input.title,
            metadata: { collection: "service_desk_knowledge", store: "qdrant", phase: "intake" },
            summarizeOutput: (items) => `${items.length} sources`
          },
          ({ spanId: ragSpanId }) => this.searchKnowledge(query, 4, { traceId, parentSpanId: ragSpanId })
        );
        const triage = await this.traces.runSpan<TriageResult>(
          {
            traceId,
            parentSpanId: spanId,
            name: "agent.ticket-triage",
            kind: "agent",
            inputSummary: `${input.urgency} ${input.affectedService}`,
            summarizeOutput: (result) => `${result.category} ${result.priority} ${Math.round(result.confidence * 100)}%`
          },
          () => this.triageAgent.run(input, sources)
        );
        const existingTickets = actor ? await this.listTicketsForUser(actor) : await this.listTickets();
        return this.traces.runSpan<IntakeAssessment>(
          {
            traceId,
            parentSpanId: spanId,
            name: "agent.intake-quality",
            kind: "agent",
            inputSummary: `${triage.category} ${input.title}`,
            summarizeOutput: (assessment) => `${assessment.readiness} ${assessment.qualityScore}/100`
          },
          () => Promise.resolve(assessTicketIntakeQuality({ input, triage, sources, existingTickets }))
        );
      }
    );
  }

  async openTicket(input: CreateTicketInput, traceLink: TraceLink = {}, actor?: AppUser, intakeAssessment?: IntakeAssessment): Promise<Ticket> {
    const traceId = traceLink.traceId ?? randomUUID();
    const created = await this.tickets.create(input);
    if (actor) {
      await this.appendAudit(created.id, actor, "ticket.created", "Chamado criado.");
    }
    this.events.publish({ type: "ticket.created", ticket: created, occurredAt: new Date().toISOString(), traceId });

    try {
      return await this.traces.runSpan(
        {
          traceId,
          parentSpanId: traceLink.parentSpanId,
          name: "ticket.open",
          kind: "workflow",
          inputSummary: `${input.title} / ${input.affectedService}`,
          metadata: { ticketId: created.id, ticketNumber: created.number },
          summarizeOutput: (ticket) => `${ticket.number} ${ticket.priority} ${ticket.status}`
        },
        async ({ spanId }) => {
          const query = `${input.title}\n${input.description}\n${input.businessImpact}`;
          const sources = await this.traces.runSpan<RagSource[]>(
            {
              traceId,
              parentSpanId: spanId,
              name: "agent.rag-retrieval",
              kind: "agent",
              inputSummary: input.title,
              metadata: { collection: "service_desk_knowledge", store: "qdrant" },
              summarizeOutput: (items) => `${items.length} sources`
            },
            ({ spanId: ragSpanId }) => this.searchKnowledge(query, 4, { traceId, parentSpanId: ragSpanId })
          );
          const triage = await this.traces.runSpan(
            {
              traceId,
              parentSpanId: spanId,
              name: "agent.ticket-triage",
              kind: "agent",
              inputSummary: `${input.urgency} ${input.affectedService}`,
              summarizeOutput: (result) => `${result.category} ${result.priority} ${Math.round(result.confidence * 100)}%`
            },
            () => this.triageAgent.run(input, sources)
          );
          const intakeQuality = await this.traces.runSpan<IntakeAssessment>(
            {
              traceId,
              parentSpanId: spanId,
              name: "agent.intake-quality",
              kind: "agent",
              inputSummary: `${triage.category} ${input.title}`,
              summarizeOutput: (assessment) => `${assessment.readiness} ${assessment.qualityScore}/100`
            },
            async () =>
              intakeAssessment ??
              assessTicketIntakeQuality({
                input,
                triage,
                sources,
                existingTickets: actor ? await this.listTicketsForUser(actor) : await this.listTickets()
              })
          );
          const routing = await this.traces.runSpan(
            {
              traceId,
              parentSpanId: spanId,
              name: "agent.routing",
              kind: "agent",
              inputSummary: `${triage.category} ${input.affectedService}`,
              summarizeOutput: (result) => result.groupName
            },
            () => Promise.resolve(buildRoutingDecision(input, triage))
          );
          const slaRisk = await this.traces.runSpan(
            {
              traceId,
              parentSpanId: spanId,
              name: "agent.sla-risk",
              kind: "agent",
              inputSummary: `${triage.priority} confidence=${triage.confidence}`,
              summarizeOutput: (result) => `${result.risk} approval=${result.requiresHumanApproval}`
            },
            () => Promise.resolve(assessSlaRisk(input, triage, sources))
          );
          const draft = await this.traces.runSpan(
            {
              traceId,
              parentSpanId: spanId,
              name: "agent.resolution-draft",
              kind: "agent",
              inputSummary: triage.summary,
              summarizeOutput: (result) => `${Math.round(result.confidence * 100)}% ${result.nextActions.length} actions`
            },
            () => this.resolutionAgent.run(input, triage, sources)
          );
          const ticketLearning = await this.traces.runSpan(
            {
              traceId,
              parentSpanId: spanId,
              name: "agent.ticket-memory",
              kind: "agent",
              inputSummary: `${triage.category} ${input.affectedService}`,
              summarizeOutput: (result) => result.slice(0, 120)
            },
            () => Promise.resolve(buildTicketLearning(input, triage, routing, slaRisk, draft.response, sources))
          );
          const now = new Date().toISOString();

          const updated = await this.tickets.update(created.id, {
            category: triage.category,
            priority: triage.priority,
            status: triage.priority === "critical" ? "escalated" : "open",
            assignedGroupId: routing.groupId,
            assignedGroupName: routing.groupName,
            sla: buildSla(triage.priority, created.createdAt),
            tags: [...new Set([...triage.tags, ...intakeQuality.suggestedFields.tags, slaRisk.riskTag])],
            ai: {
              retrievedSources: sources,
              agentMemory: [
                ...(created.ai.agentMemory ?? []),
                buildMemoryEntry(
                  created.id,
                  "intake-quality",
                  "assistant",
                  "Sistema",
                  "system",
                  intakeQuality.summary,
                  now,
                  traceId
                ),
                buildMemoryEntry(
                  created.id,
                  "rag-retrieval",
                  "assistant",
                  "Sistema",
                  "system",
                  `RAG vinculou ${sources.length} fonte(s): ${sources.map((source) => source.id).join(", ") || "nenhuma"}.`,
                  now,
                  traceId
                ),
                buildMemoryEntry(created.id, "ticket-triage", "assistant", "Sistema", "system", triage.summary, now, traceId),
                buildMemoryEntry(created.id, "routing", "assistant", "Sistema", "system", routing.summary, now, traceId),
                buildMemoryEntry(created.id, "sla-risk", "assistant", "Sistema", "system", slaRisk.summary, now, traceId),
                buildMemoryEntry(created.id, "resolution-drafter", "assistant", "Sistema", "system", draft.response, now, traceId),
                buildMemoryEntry(created.id, "ticket-memory", "system", "Memoria operacional", "ticket-memory", ticketLearning, now, traceId)
              ],
              triage: {
                agent: "ticket-triage",
                summary: triage.summary,
                confidence: triage.confidence,
                evidence: sources.map((source) => source.id),
                createdAt: now,
                metadata: {
                  slaClass: triage.slaClass,
                  missingInformation: triage.missingInformation,
                  routing,
                  slaRisk,
                  intakeQuality,
                  traceId
                }
              },
              resolutionDraft: {
                agent: "resolution-drafter",
                summary: draft.response,
                confidence: draft.confidence,
                evidence: draft.evidence,
                createdAt: now,
                metadata: {
                  nextActions: draft.nextActions,
                  traceId
                }
              }
            },
            timeline: [
              ...created.timeline,
              {
                id: randomUUID(),
                actor: "agent",
                message: intakeQuality.summary,
                createdAt: now
              },
              {
                id: randomUUID(),
                actor: "agent",
                message: triage.summary,
                createdAt: now
              },
              {
                id: randomUUID(),
                actor: "agent",
                message: routing.summary,
                createdAt: now
              },
              {
                id: randomUUID(),
                actor: "agent",
                message: slaRisk.summary,
                createdAt: now
              },
              {
                id: randomUUID(),
                actor: "agent",
                message: draft.response,
                createdAt: now
              }
            ]
          });

          if (!updated) return created;
          this.events.publish({ type: "ticket.triaged", ticket: updated, occurredAt: now, traceId });
          return updated;
        }
      );
    } catch (error) {
      this.events.publish({
        type: "agent.failed",
        ticketId: created.id,
        agent: "agent-orchestrator",
        reason: error instanceof Error ? error.message : "Unknown error",
        occurredAt: new Date().toISOString(),
        traceId
      });
      return created;
    }
  }

  async previewTriage(input: CreateTicketInput, traceLink: TraceLink = {}): Promise<TriagePreview> {
    const traceId = traceLink.traceId ?? randomUUID();
    return this.traces.runSpan<TriagePreview>(
      {
        traceId,
        parentSpanId: traceLink.parentSpanId,
        name: "ticket.preview-triage",
        kind: "workflow",
        inputSummary: `${input.title} / ${input.affectedService}`,
        summarizeOutput: (output) => `${output.triage.category} ${output.triage.priority}`
      },
      async ({ spanId }) => {
        const sources = await this.traces.runSpan(
          {
            traceId,
            parentSpanId: spanId,
            name: "rag.search",
            kind: "rag",
            inputSummary: input.title,
            summarizeOutput: (items) => `${items.length} sources`
          },
          () => this.knowledge.search(`${input.title}\n${input.description}\n${input.businessImpact}`)
        );
        const triage = await this.traces.runSpan(
          {
            traceId,
            parentSpanId: spanId,
            name: "agent.ticket-triage",
            kind: "agent",
            inputSummary: `${input.urgency} ${input.affectedService}`,
            summarizeOutput: (result) => `${result.category} ${result.priority} ${Math.round(result.confidence * 100)}%`
          },
          () => this.triageAgent.run(input, sources)
        );
        return { triage, sources };
      }
    );
  }

  async assignTicket(id: string, actor: AppUser, assignee?: AppUser): Promise<Ticket | undefined> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket || !canWorkTicket(ticket, actor)) return undefined;
    const target = assignee ?? actor;
    const now = new Date().toISOString();
    return this.tickets.update(id, {
      assigneeId: target.id,
      assigneeName: target.name,
      status: ticket.status === "new" || ticket.status === "open" || ticket.status === "triaging" ? "in_progress" : ticket.status,
      timeline: [
        ...ticket.timeline,
        {
          id: randomUUID(),
          actor: "system",
          message: `${actor.name} atribuiu o chamado para ${target.name}.`,
          createdAt: now
        }
      ],
      audit: [...ticket.audit, buildAudit(actor, "ticket.assigned", `Responsavel definido: ${target.name}.`, now)]
    });
  }

  async updateStatus(id: string, actor: AppUser, status: TicketStatus): Promise<Ticket | undefined> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket || !canWorkTicket(ticket, actor)) return undefined;
    const now = new Date().toISOString();
    return this.tickets.update(id, {
      status,
      timeline: [
        ...ticket.timeline,
        {
          id: randomUUID(),
          actor: "system",
          message: `${actor.name} alterou o status para ${statusLabel(status)}.`,
          createdAt: now
        }
      ],
      audit: [...ticket.audit, buildAudit(actor, "ticket.status_changed", `Status alterado para ${statusLabel(status)}.`, now)]
    });
  }

  async addFollowup(id: string, actor: AppUser, message: string, visibility: "public" | "internal"): Promise<Ticket | undefined> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket) return undefined;
    if (visibility === "internal" && !canWorkTicket(ticket, actor)) return undefined;
    const now = new Date().toISOString();
    const followup: TicketFollowup = {
      id: randomUUID(),
      authorId: actor.id,
      authorName: actor.name,
      visibility,
      message,
      createdAt: now
    };
    return this.tickets.update(id, {
      followups: [...ticket.followups, followup],
      timeline: [
        ...ticket.timeline,
        {
          id: randomUUID(),
          actor: actor.role === "requester" ? "requester" : "technician",
          message,
          createdAt: now
        }
      ],
      audit: [...ticket.audit, buildAudit(actor, "ticket.followup_added", "Acompanhamento registrado.", now)]
    });
  }

  async addTask(id: string, actor: AppUser, title: string, description?: string): Promise<Ticket | undefined> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket || !canWorkTicket(ticket, actor)) return undefined;
    const now = new Date().toISOString();
    const task: TicketTask = {
      id: randomUUID(),
      title,
      description,
      assigneeId: actor.id,
      assigneeName: actor.name,
      status: "todo",
      createdAt: now,
      updatedAt: now
    };
    return this.tickets.update(id, {
      tasks: [...ticket.tasks, task],
      audit: [...ticket.audit, buildAudit(actor, "ticket.task_added", `Tarefa criada: ${title}.`, now)]
    });
  }

  async completeTask(id: string, taskId: string, actor: AppUser): Promise<Ticket | undefined> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket || !canWorkTicket(ticket, actor)) return undefined;
    const now = new Date().toISOString();
    return this.tickets.update(id, {
      tasks: ticket.tasks.map((task) =>
        task.id === taskId ? { ...task, status: "done", updatedAt: now, completedAt: now } : task
      ),
      audit: [...ticket.audit, buildAudit(actor, "ticket.task_completed", "Tarefa concluida.", now)]
    });
  }

  async resolveTicket(id: string, actor: AppUser, message: string): Promise<Ticket | undefined> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket || !canWorkTicket(ticket, actor)) return undefined;
    const now = new Date().toISOString();
    return this.tickets.update(id, {
      status: "resolved",
      followups: [
        ...ticket.followups,
        {
          id: randomUUID(),
          authorId: actor.id,
          authorName: actor.name,
          visibility: "public",
          message,
          createdAt: now
        }
      ],
      timeline: [
        ...ticket.timeline,
        {
          id: randomUUID(),
          actor: "technician",
          message,
          createdAt: now
        },
        {
          id: randomUUID(),
          actor: "system",
          message: "Chamado resolvido e aguardando validacao do solicitante.",
          createdAt: now
        }
      ],
      audit: [...ticket.audit, buildAudit(actor, "ticket.resolved", "Solucao registrada.", now)]
    });
  }

  async chatWithTicket(id: string, actor: AppUser, message: string): Promise<Ticket | undefined> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket) return undefined;

    const traceId = randomUUID();
    return this.traces.runSpan(
      {
        traceId,
        name: "agent.ticket-specialist-chat",
        kind: "agent",
        inputSummary: `${ticket.number}: ${message.slice(0, 80)}`,
        metadata: { ticketId: ticket.id, actorId: actor.id, agent: "ticket-specialist" },
        summarizeOutput: (updated) => `${updated?.number ?? ticket.number} memory=${updated?.ai.agentMemory?.length ?? 0}`
      },
      async ({ spanId }) => {
        const accessibleTickets = await this.listTicketsForUser(actor);
        const memory = ticket.ai.agentMemory ?? [];
        const databaseContext = await this.traces.runSpan<TicketDatabaseResult>(
          {
            traceId,
            parentSpanId: spanId,
            name: "tool.query_service_desk_database",
            kind: "tool",
            inputSummary: `${ticket.number}: ${message.slice(0, 80)}`,
            metadata: { ticketId: ticket.id, actorId: actor.id, operation: "memory_summary" },
            summarizeOutput: (result) => `${result.count} tickets ${result.memories.length} memories`
          },
          () =>
            queryTicketDatabase(this.tickets, actor, {
              operation: "memory_summary",
              ticketId: ticket.id,
              query: `${ticket.title} ${ticket.description} ${message}`,
              includeResolved: true,
              limit: 8
            })
        );
        const sources = await this.traces.runSpan(
          {
            traceId,
            parentSpanId: spanId,
            name: "rag.search",
            kind: "rag",
            inputSummary: message,
            summarizeOutput: (items) => `${items.length} sources`
          },
          () => this.knowledge.search(`${ticket.title}\n${ticket.description}\n${message}`)
        );
        const answer = await this.specialistAgent.run({
          activeTicket: ticket,
          accessibleTickets,
          actor,
          message,
          memory,
          databaseContext,
          sources
        });
        const now = new Date().toISOString();
        const nextMemory: TicketAgentMemoryEntry[] = [
          ...memory,
          buildMemoryEntry(ticket.id, "ticket-specialist", "user", actor.name, actor.id, message, now, traceId, accessibleTickets),
          buildMemoryEntry(ticket.id, "ticket-specialist", "assistant", "Agente especialista", "ticket-specialist", answer, now, traceId, accessibleTickets)
        ];

        const updated = await this.tickets.update(id, {
          ai: {
            ...ticket.ai,
            retrievedSources: mergeSources(ticket.ai.retrievedSources, sources),
            agentMemory: nextMemory
          },
          audit: [...ticket.audit, buildAudit(actor, "agent.chat", "Conversa com agente especialista registrada.", now)]
        });

        return updated ?? ticket;
      }
    );
  }

  async *streamChatWithTicket(id: string, actor: AppUser, message: string): AsyncGenerator<TicketChatStreamEvent> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket) {
      yield { type: "error", message: "Chamado nao encontrado ou chat nao permitido." };
      return;
    }

    const traceId = randomUUID();
    const spanId = randomUUID();
    const startedAt = new Date().toISOString();
    const startedAtMs = performance.now();

    try {
      yield {
        type: "status",
        phase: "thinking",
        message: "Consultando chamados autorizados, memoria do agente e fontes RAG."
      };

      const accessibleTickets = await this.listTicketsForUser(actor);
      const memory = ticket.ai.agentMemory ?? [];
      const databaseContext = await this.traces.runSpan<TicketDatabaseResult>(
        {
          traceId,
          parentSpanId: spanId,
          name: "tool.query_service_desk_database",
          kind: "tool",
          inputSummary: `${ticket.number}: ${message.slice(0, 80)}`,
          metadata: { ticketId: ticket.id, actorId: actor.id, operation: "memory_summary", streaming: true },
          summarizeOutput: (result) => `${result.count} tickets ${result.memories.length} memories`
        },
        () =>
          queryTicketDatabase(this.tickets, actor, {
            operation: "memory_summary",
            ticketId: ticket.id,
            query: `${ticket.title} ${ticket.description} ${message}`,
            includeResolved: true,
            limit: 8
          })
      );
      const sources = await this.traces.runSpan(
        {
          traceId,
          parentSpanId: spanId,
          name: "rag.search",
          kind: "rag",
          inputSummary: message,
          summarizeOutput: (items) => `${items.length} sources`
        },
        () => this.knowledge.search(`${ticket.title}\n${ticket.description}\n${message}`)
      );
      let answer = "";

      for await (const event of this.specialistAgent.stream({
        activeTicket: ticket,
        accessibleTickets,
        actor,
        message,
        memory,
        databaseContext,
        sources
      })) {
        if (event.type === "delta") answer += event.text;
        yield event;
      }

      const now = new Date().toISOString();
      const nextMemory: TicketAgentMemoryEntry[] = [
        ...memory,
        buildMemoryEntry(ticket.id, "ticket-specialist", "user", actor.name, actor.id, message, now, traceId, accessibleTickets),
        buildMemoryEntry(ticket.id, "ticket-specialist", "assistant", "Agente especialista", "ticket-specialist", answer.trim(), now, traceId, accessibleTickets)
      ];

      const updated = await this.tickets.update(id, {
        ai: {
          ...ticket.ai,
          retrievedSources: mergeSources(ticket.ai.retrievedSources, sources),
          agentMemory: nextMemory
        },
        audit: [...ticket.audit, buildAudit(actor, "agent.chat.stream", "Conversa com agente especialista registrada em streaming.", now)]
      });
      const result = updated ?? ticket;

      this.traces.recordSpan({
        id: spanId,
        traceId,
        name: "agent.ticket-specialist-chat-stream",
        kind: "agent",
        status: "ok",
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAtMs),
        inputSummary: `${ticket.number}: ${message.slice(0, 80)}`,
        outputSummary: `${result.number} memory=${result.ai.agentMemory?.length ?? 0}`,
        metadata: { ticketId: ticket.id, actorId: actor.id, agent: "ticket-specialist", streaming: true }
      });

      yield {
        type: "ticket",
        ticket: result,
        messages: result.ai.agentMemory ?? []
      };
    } catch (cause) {
      const messageText = cause instanceof Error ? cause.message : "Erro desconhecido no chat.";
      this.traces.recordSpan({
        id: spanId,
        traceId,
        name: "agent.ticket-specialist-chat-stream",
        kind: "agent",
        status: "error",
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAtMs),
        inputSummary: `${ticket.number}: ${message.slice(0, 80)}`,
        error: messageText.slice(0, 420),
        metadata: { ticketId: ticket.id, actorId: actor.id, agent: "ticket-specialist", streaming: true }
      });
      yield {
        type: "error",
        message: "Nao foi possivel concluir a resposta do agente. Tente novamente ou registre um acompanhamento manual."
      };
    }
  }

  async deleteTicket(id: string, actor: AppUser): Promise<boolean> {
    if (!hasPermission(actor, "tickets.delete")) return false;
    return this.tickets.delete(id);
  }

  async replaceTicketAttachments(id: string, actor: AppUser, attachments: string[]): Promise<Ticket | undefined> {
    const ticket = await this.findTicketForUser(id, actor);
    if (!ticket) return undefined;
    const now = new Date().toISOString();
    return this.tickets.update(id, {
      attachments,
      audit: [...ticket.audit, buildAudit(actor, "ticket.attachments_stored", "Anexos validados e armazenados fora do registro do chamado.", now)]
    });
  }

  private async appendAudit(id: string, actor: AppUser, action: string, message: string): Promise<void> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) return;
    await this.tickets.update(id, {
      audit: [...ticket.audit, buildAudit(actor, action, message, new Date().toISOString())]
    });
  }
}

function buildRoutingDecision(input: CreateTicketInput, triage: TriageResult): RoutingDecision {
  const group = selectGroup(input);
  return {
    groupId: group.id,
    groupName: group.name,
    summary: `Agente de roteamento direcionou ${triage.category} para ${group.name}.`
  };
}

function assessSlaRisk(input: CreateTicketInput, triage: TriageResult, sources: RagSource[]): SlaRiskDecision {
  const criticalSignals = `${input.title} ${input.description} ${input.businessImpact}`.toLowerCase();
  const hasHardImpact = /(parado|bloqueado|indisponivel|security|seguranca|faturamento|revenue|compliance)/.test(criticalSignals);
  const risk = triage.priority === "critical" || hasHardImpact ? "escalate" : triage.confidence < 0.7 ? "watch" : "normal";
  const requiresHumanApproval = risk !== "normal" || triage.confidence < 0.75;
  const evidence = sources[0]?.id ? ` Evidence: ${sources[0].id}.` : "";

  return {
    risk,
    riskTag: risk === "escalate" ? "sla-risk" : risk === "watch" ? "sla-watch" : "sla-normal",
    requiresHumanApproval,
    summary: `Agente de SLA marcou risco ${slaRiskLabel(risk)} para prioridade ${priorityLabel(triage.priority)}.${evidence.replace(" Evidence:", " Evidencia:")}`
  };
}

function buildTicketLearning(
  input: CreateTicketInput,
  triage: TriageResult,
  routing: RoutingDecision,
  slaRisk: SlaRiskDecision,
  draftResponse: string,
  sources: RagSource[]
): string {
  const sourceIds = sources.map((source) => source.id).join(", ") || "sem fontes RAG";
  return [
    `Aprendizado do chamado: ${triage.category} em ${input.affectedService}.`,
    `Sinais: prioridade ${priorityLabel(triage.priority)}, urgencia ${priorityLabel(input.urgency)}, impacto ${priorityLabel(input.impact)}, risco SLA ${slaRiskLabel(slaRisk.risk)}.`,
    `Roteamento validado: ${routing.groupName}.`,
    `Impacto: ${input.businessImpact}`,
    `Resposta inicial sugerida: ${draftResponse}`,
    `Evidencias: ${sourceIds}.`
  ].join(" ");
}

function priorityLabel(priority: string): string {
  if (priority === "critical") return "critica";
  if (priority === "high") return "alta";
  if (priority === "medium") return "media";
  return "baixa";
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: "Novo",
    open: "Aberto",
    triaging: "Em triagem",
    in_progress: "Em atendimento",
    waiting_customer: "Aguardando solicitante",
    pending_approval: "Aguardando aprovacao",
    escalated: "Escalado",
    resolved: "Resolvido",
    closed: "Fechado"
  };
  return labels[status] ?? status;
}

function slaRiskLabel(risk: SlaRiskDecision["risk"]): string {
  if (risk === "escalate") return "de escalacao";
  if (risk === "watch") return "em observacao";
  return "normal";
}

function buildAudit(actor: AppUser, action: string, message: string, createdAt: string) {
  return {
    id: randomUUID(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    message,
    createdAt
  };
}

function buildMemoryEntry(
  ticketId: string,
  agent: TicketAgentMemoryEntry["agent"],
  role: TicketAgentMemoryEntry["role"],
  actorName: string,
  actorId: string,
  content: string,
  createdAt: string,
  traceId?: string,
  contextTickets: Ticket[] = []
): TicketAgentMemoryEntry {
  return {
    id: randomUUID(),
    ticketId,
    agent,
    role,
    actorId,
    actorName,
    content,
    createdAt,
    traceId,
    contextTicketIds: contextTickets.map((ticket) => ticket.id)
  };
}

function mergeSources(current: RagSource[], next: RagSource[]): RagSource[] {
  const byId = new Map(current.map((source) => [source.id, source]));
  next.forEach((source) => byId.set(source.id, source));
  return [...byId.values()].sort((a, b) => b.relevance - a.relevance).slice(0, 8);
}
