import { randomUUID } from "node:crypto";
import { buildSla } from "../../domain/serviceDeskCatalog.js";
import type { CreateTicketInput, RagSource, Ticket, TicketFollowup, TicketStatus, TicketTask } from "../../domain/ticket.js";
import { DomainEventBus } from "../../domain/events.js";
import type { TicketStore } from "../../domain/ticketRepository.js";
import { AuditLog } from "../../observability/auditLog.js";
import { TraceRecorder } from "../../observability/traces.js";
import type { AppUser } from "../../security/authStore.js";
import { QdrantKnowledgeBase } from "../rag/QdrantKnowledgeBase.js";
import { ResolutionDraftAgent } from "./ResolutionDraftAgent.js";
import { TicketTriageAgent, type TriageResult } from "./TicketTriageAgent.js";

export type TraceLink = {
  traceId?: string;
  parentSpanId?: string;
};

export type TriagePreview = {
  triage: TriageResult;
  sources: RagSource[];
};

export class AgentOrchestrator {
  constructor(
    private readonly tickets: TicketStore,
    private readonly knowledge: QdrantKnowledgeBase,
    private readonly triageAgent: TicketTriageAgent,
    private readonly resolutionAgent: ResolutionDraftAgent,
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

  async openTicket(input: CreateTicketInput, traceLink: TraceLink = {}, actor?: AppUser): Promise<Ticket> {
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
          const sources = await this.traces.runSpan(
            {
              traceId,
              parentSpanId: spanId,
              name: "rag.search",
              kind: "rag",
              inputSummary: input.title,
              metadata: { collection: "service_desk_knowledge" },
              summarizeOutput: (items) => `${items.length} sources`
            },
            () => this.knowledge.search(query)
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
          const now = new Date().toISOString();

          const updated = await this.tickets.update(created.id, {
            category: triage.category,
            priority: triage.priority,
            status: triage.priority === "critical" ? "escalated" : "open",
            sla: buildSla(triage.priority, created.createdAt),
            tags: triage.tags,
            ai: {
              retrievedSources: sources,
              triage: {
                agent: "ticket-triage",
                summary: triage.summary,
                confidence: triage.confidence,
                evidence: sources.map((source) => source.id),
                createdAt: now,
                metadata: {
                  slaClass: triage.slaClass,
                  missingInformation: triage.missingInformation,
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
                message: triage.summary,
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
          message: `${actor.name} alterou o status para ${status}.`,
          createdAt: now
        }
      ],
      audit: [...ticket.audit, buildAudit(actor, "ticket.status_changed", `Status alterado para ${status}.`, now)]
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

  async deleteTicket(id: string, actor: AppUser): Promise<boolean> {
    if (actor.role !== "admin") return false;
    return this.tickets.delete(id);
  }

  private async appendAudit(id: string, actor: AppUser, action: string, message: string): Promise<void> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) return;
    await this.tickets.update(id, {
      audit: [...ticket.audit, buildAudit(actor, action, message, new Date().toISOString())]
    });
  }
}

function canAccessTicket(ticket: Ticket, user: AppUser): boolean {
  if (user.role === "admin" || user.role === "supervisor") return true;
  if (ticket.requesterEmail.toLowerCase() === user.email.toLowerCase()) return true;
  if (user.role === "technician") {
    return Boolean(ticket.assigneeId === user.id || (ticket.assignedGroupId && user.groupIds.includes(ticket.assignedGroupId)));
  }
  return false;
}

function canWorkTicket(ticket: Ticket, user: AppUser): boolean {
  if (user.role === "admin" || user.role === "supervisor") return true;
  return user.role === "technician" && canAccessTicket(ticket, user);
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
