import { AgentOrchestrator } from "../agents/AgentOrchestrator.js";
import { ResolutionDraftAgent } from "../agents/ResolutionDraftAgent.js";
import { TicketSpecialistChatAgent } from "../agents/TicketSpecialistChatAgent.js";
import { TicketTriageAgent } from "../agents/TicketTriageAgent.js";
import { ModelGateway } from "../modelGateway.js";
import { QdrantKnowledgeBase } from "../rag/QdrantKnowledgeBase.js";
import type { AppEnv } from "../../config/env.js";
import { DomainEventBus } from "../../domain/events.js";
import { normalizeCreateTicketInput } from "../../domain/ticket.js";
import { TicketRepository } from "../../domain/ticketRepository.js";
import { AuditLog } from "../../observability/auditLog.js";
import { TraceRecorder } from "../../observability/traces.js";
import {
  scoreIntakeOutcome,
  scoreRagGrounding,
  scoreTicketOutcome,
  scoreWorkflowTrajectory,
  summarizeServiceDeskEval,
  type ScorerResult,
  type ServiceDeskEvalCase
} from "./serviceDeskScorers.js";

export type ServiceDeskEvalCaseReport = {
  id: string;
  name: string;
  passed: boolean;
  score: number;
  summary: string;
  durationMs: number;
  modelRoute: string;
  executionMode: "model-cascade" | "deterministic-fallback";
  sourceIds: string[];
  expectedSpans: string[];
  observedSpans: string[];
  scorers: ScorerResult[];
};

export type ServiceDeskEvalScorerSummary = {
  id: string;
  passRate: number;
  averageScore: number;
  passed: number;
  failed: number;
  failedCases: string[];
};

export type ServiceDeskEvalReport = {
  suiteId: "service-desk-agent-baseline";
  generatedAt: string;
  score: number;
  passRate: number;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  modelRoute: string;
  executionMode: "model-cascade" | "deterministic-fallback";
  cases: ServiceDeskEvalCaseReport[];
  scorers: ServiceDeskEvalScorerSummary[];
};

export const serviceDeskEvalCases: ServiceDeskEvalCase[] = [
  {
    id: "erp-critical-approval",
    name: "critical ERP billing incident requires human approval",
    input: normalizeCreateTicketInput({
      requesterEmail: "ana@acme.local",
      department: "Financeiro",
      title: "Faturamento bloqueado no ERP",
      description: "O lote de faturamento do ERP falhou com erro FIS-103 desde 09:00 e a filial SP esta parada.",
      affectedService: "ERP Central",
      urgency: "critical",
      impact: "critical",
      businessImpact: "Fechamento mensal e emissao de notas parados para clientes da filial SP.",
      attachments: []
    }),
    expected: {
      shouldCreate: true,
      readiness: "ready",
      minQualityScore: 55,
      priority: "critical",
      requiresApproval: true,
      sourceIds: ["kb-erp-billing-lock"],
      spans: ["ticket.open", "agent.rag-retrieval", "rag.search", "agent.ticket-triage", "agent.sla-risk", "agent.resolution-draft"]
    }
  },
  {
    id: "weak-intake-blocked",
    name: "vague request is blocked before ticket creation",
    input: normalizeCreateTicketInput({
      requesterEmail: "ana@acme.local",
      department: "Operacoes",
      title: "Problema urgente",
      description: "Nao funciona direito desde ontem e preciso de ajuda urgente.",
      affectedService: "Geral",
      urgency: "medium",
      impact: "medium",
      businessImpact: "Nao sei.",
      attachments: []
    }),
    expected: {
      shouldCreate: false,
      readiness: "needs_info",
      spans: ["ticket.intake-assessment", "agent.intake-quality", "agent.ticket-triage"]
    }
  },
  {
    id: "identity-self-service",
    name: "low-risk password question is deflected to self-service but remains creatable",
    input: normalizeCreateTicketInput({
      requesterEmail: "bruno@acme.local",
      department: "Comercial",
      title: "Como redefinir senha com MFA",
      description: "Como faco para redefinir minha senha e validar o MFA hoje para acessar o portal interno?",
      affectedService: "Identity Access",
      urgency: "low",
      impact: "low",
      businessImpact: "Usuario individual precisa voltar a acessar o portal, sem impacto em equipe.",
      attachments: []
    }),
    expected: {
      shouldCreate: true,
      readiness: "self_service",
      minQualityScore: 45,
      priority: "low",
      requiresApproval: false,
      sourceIds: ["kb-access-reset"],
      spans: ["ticket.open", "agent.rag-retrieval", "agent.ticket-triage", "agent.routing"]
    }
  }
];

export async function runServiceDeskEvalSuite(
  env: AppEnv,
  options: { generatedAt?: Date; cases?: ServiceDeskEvalCase[] } = {}
): Promise<ServiceDeskEvalReport> {
  const cases = options.cases ?? serviceDeskEvalCases;
  const reports: ServiceDeskEvalCaseReport[] = [];

  for (const testCase of cases) {
    reports.push(await runEvalCase(env, testCase));
  }

  const passedCases = reports.filter((report) => report.passed).length;
  const score = reports.length ? percent(reports.reduce((sum, report) => sum + report.score, 0) / reports.length / 100) : 100;
  const firstReport = reports[0];

  return {
    suiteId: "service-desk-agent-baseline",
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    score,
    passRate: reports.length ? percent(passedCases / reports.length) : 100,
    totalCases: reports.length,
    passedCases,
    failedCases: reports.length - passedCases,
    modelRoute: firstReport?.modelRoute ?? "local-fallback",
    executionMode: firstReport?.executionMode ?? "deterministic-fallback",
    cases: reports,
    scorers: summarizeScorers(reports)
  };
}

async function runEvalCase(env: AppEnv, testCase: ServiceDeskEvalCase): Promise<ServiceDeskEvalCaseReport> {
  const startedAt = Date.now();

  try {
    const { orchestrator, traces, llm } = buildEvalOrchestrator(env);
    const assessment = await orchestrator.assessIntake(testCase.input);
    const ticket = assessment.shouldCreate ? await orchestrator.openTicket(testCase.input, {}, undefined, assessment) : undefined;
    const spans = traces.list(100);
    const result = summarizeServiceDeskEval(testCase.id, [
      scoreIntakeOutcome(testCase, assessment),
      scoreTicketOutcome(testCase, ticket),
      scoreRagGrounding(testCase, assessment, ticket),
      scoreWorkflowTrajectory(testCase, spans)
    ]);
    const failedScorers = result.scorers.filter((scorer) => !scorer.passed);

    return {
      id: testCase.id,
      name: testCase.name,
      passed: result.passed,
      score: percent(result.score),
      summary: failedScorers.length ? failedScorers.map((scorer) => `${scorer.id}: ${scorer.reason}`).join("; ") : "All scorers passed.",
      durationMs: Date.now() - startedAt,
      modelRoute: llm.routeLabel,
      executionMode: llm.executionMode,
      sourceIds: dedupe([
        ...assessment.ragSources.map((source) => source.id),
        ...(ticket?.ai.retrievedSources ?? []).map((source) => source.id)
      ]),
      expectedSpans: testCase.expected.spans ?? [],
      observedSpans: spans.map((span) => span.name),
      scorers: result.scorers
    };
  } catch (cause) {
    return {
      id: testCase.id,
      name: testCase.name,
      passed: false,
      score: 0,
      summary: safeErrorMessage(cause),
      durationMs: Date.now() - startedAt,
      modelRoute: "local-fallback",
      executionMode: "deterministic-fallback",
      sourceIds: [],
      expectedSpans: testCase.expected.spans ?? [],
      observedSpans: [],
      scorers: [
        {
          id: "suite-error",
          score: 0,
          passed: false,
          reason: safeErrorMessage(cause)
        }
      ]
    };
  }
}

function buildEvalOrchestrator(env: AppEnv): { orchestrator: AgentOrchestrator; traces: TraceRecorder; llm: ModelGateway } {
  const evalEnv = makeEvalEnv(env);
  const llm = new ModelGateway(evalEnv);
  const traces = new TraceRecorder();
  const orchestrator = new AgentOrchestrator(
    new TicketRepository(),
    new QdrantKnowledgeBase(evalEnv, llm),
    new TicketTriageAgent(llm),
    new ResolutionDraftAgent(llm),
    new TicketSpecialistChatAgent(llm),
    new DomainEventBus(),
    new AuditLog(),
    traces
  );

  return { orchestrator, traces, llm };
}

function makeEvalEnv(env: AppEnv): AppEnv {
  return {
    ...env,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    API_KEYS: "",
    AI_PROVIDER: "mock",
    GOOGLE_GENERATIVE_AI_API_KEY: "",
    XAI_API_KEY: "",
    TICKET_STORAGE: "memory",
    TICKET_REDIS_PREFIX: "ai-service-desk-eval-report",
    TICKET_SEED_SAMPLE_DATA: false,
    QDRANT_COLLECTION: `${env.QDRANT_COLLECTION}_eval_report`
  };
}

function summarizeScorers(cases: ServiceDeskEvalCaseReport[]): ServiceDeskEvalScorerSummary[] {
  const byScorer = new Map<string, Array<{ caseId: string; result: ScorerResult }>>();

  cases.forEach((item) => {
    item.scorers.forEach((scorer) => {
      const current = byScorer.get(scorer.id) ?? [];
      current.push({ caseId: item.id, result: scorer });
      byScorer.set(scorer.id, current);
    });
  });

  return [...byScorer.entries()].map(([id, results]) => {
    const passed = results.filter((item) => item.result.passed).length;
    return {
      id,
      passRate: percent(passed / results.length),
      averageScore: percent(results.reduce((sum, item) => sum + item.result.score, 0) / results.length),
      passed,
      failed: results.length - passed,
      failedCases: results.filter((item) => !item.result.passed).map((item) => item.caseId)
    };
  });
}

function percent(value: number): number {
  return Math.round(value * 100);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function safeErrorMessage(cause: unknown): string {
  if (!(cause instanceof Error)) return "unknown error";
  const message = cause.message.trim();
  return message || "unknown error";
}
