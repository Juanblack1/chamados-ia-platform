import type { CreateTicketInput, Ticket, TicketPriority } from "../../domain/ticket.js";
import type { TraceSpan } from "../../observability/traces.js";
import type { IntakeAssessment, IntakeReadiness } from "../agents/IntakeQualityAgent.js";

export type ServiceDeskEvalCase = {
  id: string;
  name: string;
  input: CreateTicketInput;
  expected: {
    shouldCreate: boolean;
    readiness?: IntakeReadiness;
    minQualityScore?: number;
    priority?: TicketPriority;
    requiresApproval?: boolean;
    sourceIds?: string[];
    spans?: string[];
  };
};

export type ScorerResult = {
  id: string;
  score: number;
  passed: boolean;
  reason: string;
};

export type ServiceDeskEvalResult = {
  caseId: string;
  score: number;
  passed: boolean;
  scorers: ScorerResult[];
};

export function scoreIntakeOutcome(testCase: ServiceDeskEvalCase, assessment: IntakeAssessment): ScorerResult {
  const expected = testCase.expected;
  const failures = [
    assessment.shouldCreate === expected.shouldCreate ? null : `shouldCreate=${assessment.shouldCreate}`,
    expected.readiness && assessment.readiness !== expected.readiness ? `readiness=${assessment.readiness}` : null,
    expected.minQualityScore !== undefined && assessment.qualityScore < expected.minQualityScore
      ? `quality=${assessment.qualityScore}<${expected.minQualityScore}`
      : null
  ].filter(Boolean);

  return buildScorerResult("intake-outcome", failures);
}

export function scoreTicketOutcome(testCase: ServiceDeskEvalCase, ticket: Ticket | undefined): ScorerResult {
  if (!testCase.expected.shouldCreate) {
    return buildScorerResult("ticket-outcome", ticket ? ["ticket-created-for-blocked-case"] : []);
  }

  const failures = [
    ticket ? null : "ticket-not-created",
    ticket && testCase.expected.priority && ticket.priority !== testCase.expected.priority ? `priority=${ticket.priority}` : null,
    ticket && testCase.expected.requiresApproval !== undefined && hasPendingApproval(ticket) !== testCase.expected.requiresApproval
      ? `requiresApproval=${hasPendingApproval(ticket)}`
      : null
  ].filter(Boolean);

  return buildScorerResult("ticket-outcome", failures);
}

export function scoreRagGrounding(testCase: ServiceDeskEvalCase, assessment: IntakeAssessment, ticket?: Ticket): ScorerResult {
  const expectedIds = testCase.expected.sourceIds ?? [];
  if (expectedIds.length === 0) return buildScorerResult("rag-grounding", []);

  const observed = new Set([
    ...assessment.ragSources.map((source) => source.id),
    ...(ticket?.ai.retrievedSources ?? []).map((source) => source.id),
    ...(ticket?.ai.triage?.evidence ?? [])
  ]);
  const missing = expectedIds.filter((sourceId) => !observed.has(sourceId));

  return buildScorerResult("rag-grounding", missing.map((sourceId) => `missing-source:${sourceId}`));
}

export function scoreWorkflowTrajectory(testCase: ServiceDeskEvalCase, spans: TraceSpan[]): ScorerResult {
  const expectedSpans = testCase.expected.spans ?? [];
  if (expectedSpans.length === 0) return buildScorerResult("workflow-trajectory", []);

  const observed = new Set(spans.map((span) => span.name));
  const missing = expectedSpans.filter((spanName) => !observed.has(spanName));

  return buildScorerResult("workflow-trajectory", missing.map((spanName) => `missing-span:${spanName}`));
}

export function summarizeServiceDeskEval(caseId: string, scorers: ScorerResult[]): ServiceDeskEvalResult {
  const score = scorers.length ? average(scorers.map((scorer) => scorer.score)) : 1;

  return {
    caseId,
    score,
    passed: scorers.every((scorer) => scorer.passed),
    scorers
  };
}

function buildScorerResult(id: string, failures: Array<string | null | undefined>): ScorerResult {
  const actualFailures = failures.filter((failure): failure is string => Boolean(failure));
  return {
    id,
    score: actualFailures.length === 0 ? 1 : 0,
    passed: actualFailures.length === 0,
    reason: actualFailures.length === 0 ? "ok" : actualFailures.join("; ")
  };
}

function hasPendingApproval(ticket: Ticket): boolean {
  return ticket.approvals.some((approval) => approval.status === "requested");
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
