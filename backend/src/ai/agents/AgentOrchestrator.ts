import { randomUUID } from "node:crypto";
import type { CreateTicketInput, RagSource, Ticket } from "../../domain/ticket.js";
import { DomainEventBus } from "../../domain/events.js";
import { TicketRepository } from "../../domain/ticketRepository.js";
import { AuditLog } from "../../observability/auditLog.js";
import { TraceRecorder } from "../../observability/traces.js";
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
    private readonly tickets: TicketRepository,
    private readonly knowledge: QdrantKnowledgeBase,
    private readonly triageAgent: TicketTriageAgent,
    private readonly resolutionAgent: ResolutionDraftAgent,
    private readonly events: DomainEventBus,
    private readonly auditLog: AuditLog,
    private readonly traces: TraceRecorder
  ) {
    this.events.onAny((event) => this.auditLog.record(event));
  }

  listTickets(): Ticket[] {
    return this.tickets.list();
  }

  findTicket(id: string): Ticket | undefined {
    return this.tickets.findById(id);
  }

  listAuditEvents() {
    return this.auditLog.list();
  }

  async openTicket(input: CreateTicketInput, traceLink: TraceLink = {}): Promise<Ticket> {
    const traceId = traceLink.traceId ?? randomUUID();
    const created = this.tickets.create(input);
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

          const updated = this.tickets.update(created.id, {
            category: triage.category,
            priority: triage.priority,
            status: triage.priority === "critical" ? "escalated" : "open",
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
}
