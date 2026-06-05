import { z } from "zod";
import { TicketPrioritySchema } from "../../domain/ticket.js";
import { defineServiceDeskScorer, type ServiceDeskScorer } from "./typedMastraPrimitives.js";

const IntakeReadinessSchema = z.enum(["ready", "needs_info", "self_service"]);

const IntakeOutcomeInputSchema = z.object({
  expectedShouldCreate: z.boolean().default(true),
  minQualityScore: z.number().min(0).max(100).default(70),
  acceptedReadiness: z.array(IntakeReadinessSchema).default(["ready"])
});

const IntakeOutcomeOutputSchema = z.object({
  shouldCreate: z.boolean(),
  readiness: IntakeReadinessSchema,
  qualityScore: z.number().min(0).max(100),
  missingInformation: z.array(z.string()).default([])
});

const TicketOutcomeInputSchema = z.object({
  expectedCreated: z.boolean().default(true),
  expectedPriority: TicketPrioritySchema.optional(),
  expectedApproval: z.boolean().optional()
});

const TicketOutcomeOutputSchema = z.object({
  ticketCreated: z.boolean(),
  priority: TicketPrioritySchema.optional(),
  requiresApproval: z.boolean().optional(),
  ticketNumber: z.string().optional()
});

const RagGroundingInputSchema = z.object({
  expectedSourceIds: z.array(z.string()).default([])
});

const RagGroundingOutputSchema = z.object({
  sourceIds: z.array(z.string()).default([])
});

const WorkflowTrajectoryInputSchema = z.object({
  expectedSpans: z.array(z.string()).default([])
});

const WorkflowTrajectoryOutputSchema = z.object({
  observedSpans: z.array(z.string()).default([])
});

export const intakeOutcomeScorer = defineServiceDeskScorer({
  id: "intake-outcome",
  name: "Intake Outcome",
  description:
    "Scores whether intake quality produced the expected create/block decision, accepted readiness, and minimum quality score.",
  type: {
    input: IntakeOutcomeInputSchema,
    output: IntakeOutcomeOutputSchema
  }
})
  .generateScore(({ run }) => {
    const input = IntakeOutcomeInputSchema.parse(run.input ?? {});
    const output = IntakeOutcomeOutputSchema.parse(run.output);
    const createMatches = output.shouldCreate === input.expectedShouldCreate;
    const readinessMatches = input.acceptedReadiness.includes(output.readiness);
    const qualityMatches = output.qualityScore >= input.minQualityScore;

    return createMatches && readinessMatches && qualityMatches ? 1 : 0;
  })
  .generateReason(({ run, score }) => {
    if (score === 1) return "intake-ok";

    const input = IntakeOutcomeInputSchema.parse(run.input ?? {});
    const output = IntakeOutcomeOutputSchema.parse(run.output);
    const reasons = [
      output.shouldCreate === input.expectedShouldCreate ? undefined : `create-mismatch:${output.shouldCreate}`,
      input.acceptedReadiness.includes(output.readiness) ? undefined : `readiness:${output.readiness}`,
      output.qualityScore >= input.minQualityScore ? undefined : `quality:${output.qualityScore}<${input.minQualityScore}`,
      output.missingInformation.length ? `missing:${output.missingInformation.join("|")}` : undefined
    ].filter((reason): reason is string => Boolean(reason));

    return reasons.join("; ");
  });

export const ticketOutcomeScorer = defineServiceDeskScorer({
  id: "ticket-outcome",
  name: "Ticket Outcome",
  description: "Scores whether the workflow created or blocked a ticket with the expected priority and approval state.",
  type: {
    input: TicketOutcomeInputSchema,
    output: TicketOutcomeOutputSchema
  }
})
  .generateScore(({ run }) => {
    const input = TicketOutcomeInputSchema.parse(run.input ?? {});
    const output = TicketOutcomeOutputSchema.parse(run.output);
    const createdMatches = output.ticketCreated === input.expectedCreated;
    const priorityMatches = !input.expectedPriority || output.priority === input.expectedPriority;
    const approvalMatches = input.expectedApproval === undefined || output.requiresApproval === input.expectedApproval;

    return createdMatches && priorityMatches && approvalMatches ? 1 : 0;
  })
  .generateReason(({ run, score }) => {
    const input = TicketOutcomeInputSchema.parse(run.input ?? {});
    const output = TicketOutcomeOutputSchema.parse(run.output);
    if (score === 1) return output.ticketNumber ? `ticket-ok:${output.ticketNumber}` : "ticket-ok";

    const reasons = [
      output.ticketCreated === input.expectedCreated ? undefined : `created:${output.ticketCreated}`,
      !input.expectedPriority || output.priority === input.expectedPriority
        ? undefined
        : `priority:${output.priority ?? "none"}`,
      input.expectedApproval === undefined || output.requiresApproval === input.expectedApproval
        ? undefined
        : `approval:${output.requiresApproval ?? "none"}`
    ].filter((reason): reason is string => Boolean(reason));

    return reasons.join("; ");
  });

export const ragGroundingScorer = defineServiceDeskScorer({
  id: "rag-grounding",
  name: "RAG Grounding",
  description: "Scores whether the output cites every expected service desk knowledge source ID.",
  type: {
    input: RagGroundingInputSchema,
    output: RagGroundingOutputSchema
  }
})
  .generateScore(({ run }) => {
    const input = RagGroundingInputSchema.parse(run.input ?? {});
    const output = RagGroundingOutputSchema.parse(run.output);
    const missing = missingExpected(input.expectedSourceIds, output.sourceIds);
    return missing.length === 0 ? 1 : 0;
  })
  .generateReason(({ run, score }) => {
    if (score === 1) return "rag-grounded";
    const input = RagGroundingInputSchema.parse(run.input ?? {});
    const output = RagGroundingOutputSchema.parse(run.output);
    return missingExpected(input.expectedSourceIds, output.sourceIds)
      .map((sourceId) => `missing-source:${sourceId}`)
      .join("; ");
  });

export const workflowTrajectoryScorer = defineServiceDeskScorer({
  id: "workflow-trajectory",
  name: "Workflow Trajectory",
  description: "Scores whether observed trace span names include every expected service desk workflow step.",
  type: {
    input: WorkflowTrajectoryInputSchema,
    output: WorkflowTrajectoryOutputSchema
  }
})
  .generateScore(({ run }) => {
    const input = WorkflowTrajectoryInputSchema.parse(run.input ?? {});
    const output = WorkflowTrajectoryOutputSchema.parse(run.output);
    const missing = missingExpected(input.expectedSpans, output.observedSpans);
    return missing.length === 0 ? 1 : 0;
  })
  .generateReason(({ run, score }) => {
    if (score === 1) return "workflow-trajectory-ok";
    const input = WorkflowTrajectoryInputSchema.parse(run.input ?? {});
    const output = WorkflowTrajectoryOutputSchema.parse(run.output);
    return missingExpected(input.expectedSpans, output.observedSpans)
      .map((spanName) => `missing-span:${spanName}`)
      .join("; ");
  });

export const serviceDeskMastraScorers: Record<string, ServiceDeskScorer> = {
  intakeOutcome: intakeOutcomeScorer,
  ticketOutcome: ticketOutcomeScorer,
  ragGrounding: ragGroundingScorer,
  workflowTrajectory: workflowTrajectoryScorer
};

function missingExpected(expected: string[], observed: string[]): string[] {
  const observedSet = new Set(observed);
  return expected.filter((item) => !observedSet.has(item));
}
