import { z } from "zod";
import { loadEnv } from "../../config/env.js";
import { DomainEventBus } from "../../domain/events.js";
import {
  CreateTicketInputSchema,
  TicketPrioritySchema,
  TicketStatusSchema,
  normalizeCreateTicketInput,
  type Ticket
} from "../../domain/ticket.js";
import { createTicketStore } from "../../domain/ticketStore.js";
import { AuditLog } from "../../observability/auditLog.js";
import { TraceRecorder } from "../../observability/traces.js";
import { AgentOrchestrator } from "../agents/AgentOrchestrator.js";
import { ResolutionDraftAgent } from "../agents/ResolutionDraftAgent.js";
import { TicketSpecialistChatAgent } from "../agents/TicketSpecialistChatAgent.js";
import { TicketTriageAgent } from "../agents/TicketTriageAgent.js";
import { ModelGateway } from "../modelGateway.js";
import { QdrantKnowledgeBase } from "../rag/QdrantKnowledgeBase.js";
import { RagSourceSchema } from "./serviceDeskTools.js";
import { createTicketDatabaseTool } from "./ticketDatabaseTool.js";
import { defineServiceDeskStep, defineServiceDeskWorkflow } from "./typedMastraPrimitives.js";

const IntakeSummarySchema = z.object({
  readiness: z.enum(["ready", "needs_info", "self_service"]),
  shouldCreate: z.boolean(),
  qualityScore: z.number().min(0).max(100),
  summary: z.string(),
  missingInformation: z.array(z.string()),
  clarificationQuestions: z.array(z.string()),
  ragSources: z.array(RagSourceSchema)
});

const WorkflowTicketSummarySchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  assignedGroupName: z.string().optional(),
  requesterEmail: z.string().email(),
  sourceIds: z.array(z.string()),
  requiresApproval: z.boolean()
});

const OrchestratorStepOutputSchema = z.object({
  status: z.enum(["created", "blocked"]),
  intake: IntakeSummarySchema,
  ticket: WorkflowTicketSummarySchema.optional(),
  sourceIds: z.array(z.string()),
  observedSpans: z.array(z.string()),
  traceIds: z.array(z.string())
});

const ScoreSummarySchema = z.object({
  score: z.number().min(0).max(1),
  reason: z.string()
});

const ScoredWorkflowOutputSchema = OrchestratorStepOutputSchema.extend({
  expectedSpans: z.array(z.string()),
  missingSpans: z.array(z.string()),
  scores: z.object({
    intakeOutcome: ScoreSummarySchema,
    ticketOutcome: ScoreSummarySchema,
    ragGrounding: ScoreSummarySchema,
    workflowTrajectory: ScoreSummarySchema
  })
});

export const ServiceDeskWorkflowOutputSchema = ScoredWorkflowOutputSchema.extend({
  summary: z.string()
});

const runServiceDeskOrchestratorStep = defineServiceDeskStep({
  id: "run-service-desk-orchestrator",
  description:
    "Runs the real service desk orchestrator: intake quality, RAG retrieval, triage, routing, SLA risk, resolution draft, ticket memory, and audit traces.",
  inputSchema: CreateTicketInputSchema,
  outputSchema: OrchestratorStepOutputSchema,
  execute: async ({ inputData }) => {
    const { orchestrator, traces } = await buildWorkflowRuntime();
    const input = normalizeCreateTicketInput(CreateTicketInputSchema.parse(inputData));
    const assessment = await orchestrator.assessIntake(input);
    const ticket = assessment.shouldCreate ? await orchestrator.openTicket(input, {}, undefined, assessment) : undefined;
    const observedTraceSpans = traces.list(100);
    const sourceIds = collectSourceIds([
      ...assessment.ragSources,
      ...(ticket?.ai.retrievedSources ?? [])
    ]);

    return {
      status: ticket ? "created" : "blocked",
      intake: {
        readiness: assessment.readiness,
        shouldCreate: assessment.shouldCreate,
        qualityScore: assessment.qualityScore,
        summary: assessment.summary,
        missingInformation: assessment.missingInformation,
        clarificationQuestions: assessment.clarificationQuestions,
        ragSources: assessment.ragSources
      },
      ticket: ticket ? summarizeWorkflowTicket(ticket) : undefined,
      sourceIds,
      observedSpans: [...new Set(observedTraceSpans.map((span) => span.name))],
      traceIds: [...new Set(observedTraceSpans.map((span) => span.traceId))]
    };
  }
});

const scoreServiceDeskWorkflowStep = defineServiceDeskStep({
  id: "score-service-desk-workflow",
  description: "Scores intake outcome, ticket outcome, RAG grounding, and workflow trajectory for the orchestrator run.",
  inputSchema: OrchestratorStepOutputSchema,
  outputSchema: ScoredWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const parsedInput = OrchestratorStepOutputSchema.parse(inputData);
    const expectedSpans = expectedSpansForStatus(parsedInput.status);
    const missingSpans = missingExpected(expectedSpans, parsedInput.observedSpans);
    const expectedSourceIds = expectedSourceIdsFor(parsedInput);
    const missingSources = missingExpected(expectedSourceIds, parsedInput.sourceIds);

    return {
      ...parsedInput,
      expectedSpans,
      missingSpans,
      scores: {
        intakeOutcome: scoreSummary(
          parsedInput.intake.shouldCreate === (parsedInput.status === "created") && parsedInput.intake.qualityScore >= 35,
          parsedInput.intake.shouldCreate ? "intake-ok" : parsedInput.intake.summary
        ),
        ticketOutcome: scoreSummary(
          parsedInput.status === "blocked" || Boolean(parsedInput.ticket?.number),
          parsedInput.ticket?.number ? `ticket-ok:${parsedInput.ticket.number}` : "ticket-blocked-before-open"
        ),
        ragGrounding: scoreSummary(
          missingSources.length === 0,
          missingSources.length ? missingSources.map((sourceId) => `missing-source:${sourceId}`).join("; ") : "rag-grounded"
        ),
        workflowTrajectory: scoreSummary(
          missingSpans.length === 0,
          missingSpans.length ? missingSpans.map((spanName) => `missing-span:${spanName}`).join("; ") : "workflow-trajectory-ok"
        )
      }
    };
  }
});

const summarizeServiceDeskWorkflowStep = defineServiceDeskStep({
  id: "summarize-service-desk-workflow",
  description: "Builds a concise operational summary for Studio debugging and workflow run inspection.",
  inputSchema: ScoredWorkflowOutputSchema,
  outputSchema: ServiceDeskWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const parsedInput = ScoredWorkflowOutputSchema.parse(inputData);
    return {
      ...parsedInput,
      summary:
        parsedInput.status === "created" && parsedInput.ticket
          ? `Chamado ${parsedInput.ticket.number} criado com prioridade ${parsedInput.ticket.priority}, status ${parsedInput.ticket.status}, grupo ${parsedInput.ticket.assignedGroupName ?? "sem grupo"} e ${parsedInput.sourceIds.length} fonte(s) RAG.`
          : `Abertura bloqueada: ${parsedInput.intake.summary}`
    };
  }
});

export const openServiceDeskTicketWorkflow = defineServiceDeskWorkflow({
  id: "open-service-desk-ticket-workflow",
  description:
    "Open a corporate service desk ticket with intake quality, RAG retrieval, triage, routing, SLA risk, resolution draft, memory, and governance scores.",
  inputSchema: CreateTicketInputSchema,
  outputSchema: ServiceDeskWorkflowOutputSchema
})
  .then(runServiceDeskOrchestratorStep)
  .then(scoreServiceDeskWorkflowStep)
  .then(summarizeServiceDeskWorkflowStep)
  .commit();

export const serviceDeskWorkflows = {
  openServiceDeskTicketWorkflow
};

async function buildWorkflowRuntime(): Promise<{ orchestrator: AgentOrchestrator; traces: TraceRecorder }> {
  const env = loadEnv();
  const llm = new ModelGateway(env);
  const tickets = await createTicketStore(env);
  const traces = new TraceRecorder();
  const knowledge = new QdrantKnowledgeBase(env, llm);
  const databaseTool = createTicketDatabaseTool(tickets);

  return {
    traces,
    orchestrator: new AgentOrchestrator(
      tickets,
      knowledge,
      new TicketTriageAgent(llm),
      new ResolutionDraftAgent(llm),
      new TicketSpecialistChatAgent(llm, databaseTool),
      new DomainEventBus(),
      new AuditLog(),
      traces
    )
  };
}

function summarizeWorkflowTicket(ticket: Ticket) {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    assignedGroupName: ticket.assignedGroupName,
    requesterEmail: ticket.requesterEmail,
    sourceIds: ticket.ai.retrievedSources.map((source) => source.id),
    requiresApproval: ticket.approvals.some((approval) => approval.status === "requested")
  };
}

function expectedSpansForStatus(status: "created" | "blocked"): string[] {
  const intakeSpans = ["ticket.intake-assessment", "agent.rag-retrieval", "rag.search", "agent.ticket-triage", "agent.intake-quality"];
  if (status === "blocked") return intakeSpans;

  return [
    ...intakeSpans,
    "ticket.open",
    "agent.routing",
    "agent.sla-risk",
    "agent.resolution-draft",
    "agent.ticket-memory"
  ];
}

function expectedSourceIdsFor(output: { status: "created" | "blocked"; sourceIds: string[] }): string[] {
  if (output.status === "blocked") return [];
  return output.sourceIds.length ? [output.sourceIds[0]] : [];
}

function scoreSummary(condition: boolean, reason: string) {
  return {
    score: condition ? 1 : 0,
    reason
  };
}

function collectSourceIds(sources: Array<{ id: string }>): string[] {
  return [...new Set(sources.map((source) => source.id))];
}

function missingExpected(expected: string[], observed: string[]): string[] {
  const observedSet = new Set(observed);
  return expected.filter((item) => !observedSet.has(item));
}
