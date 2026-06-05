import { Activity, Bot, Clock3, Database, FileSearch, FileWarning, ShieldCheck, type LucideIcon } from "lucide-react";
import type { AgentAuditEntry, ServiceDeskCatalog, ServiceDeskEvalCaseReport, ServiceDeskEvalReport, Ticket, TraceSpan } from "../../lib/api";
import { slaRisk } from "../../lib/presentation";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export type GovernanceRecommendation = {
  id: string;
  title: string;
  priority: RecommendationPriority;
  evidence: string;
  action: string;
};

export type GovernanceMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "danger" | "warning" | "info" | "success" | "neutral";
  icon: LucideIcon;
};

export type FeedbackRow = {
  id: string;
  ticketId: string;
  ticketNumber: string;
  ticketTitle: string;
  decision: "triage" | "resolution_draft";
  rating: "useful" | "needs_review" | "incorrect";
  note?: string;
  actorName: string;
  createdAt: string;
};

export function buildGovernanceModel(tickets: Ticket[], traces: TraceSpan[], agentRuns: AgentAuditEntry[], catalog: ServiceDeskCatalog | null) {
  const activeTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const pendingApprovals = tickets.filter((ticket) => ticket.approvals.some((approval) => approval.status === "requested"));
  const lowConfidence = tickets.filter((ticket) => (ticket.ai.triage?.confidence ?? 1) < 0.72);
  const slaAttention = tickets.filter((ticket) => slaRisk(ticket) !== "ok");
  const missingRag = activeTickets.filter((ticket) => ticket.ai.retrievedSources.length === 0);
  const traceErrors = traces.filter((span) => span.status === "error");
  const averageTraceMs = traces.length
    ? Math.round(traces.reduce((sum, span) => sum + span.durationMs, 0) / traces.length)
    : 0;
  const riskTickets = rankRiskTickets([...new Set([...pendingApprovals, ...slaAttention, ...lowConfidence, ...missingRag])]).slice(0, 6);
  const recommendations = buildRecommendations({
    pendingApprovals,
    lowConfidence,
    slaAttention,
    missingRag,
    traceErrors,
    activeTickets,
    agentRuns
  });
  const overallTone =
    pendingApprovals.length || traceErrors.length || slaAttention.some((ticket) => slaRisk(ticket) === "breached")
      ? "warning"
      : "success";

  return {
    activeTickets,
    pendingApprovals,
    lowConfidence,
    slaAttention,
    missingRag,
    traceErrors,
    averageTraceMs,
    riskTickets,
    recommendations,
    recentSpans: traces.slice(0, 8),
    recentAudit: agentRuns.slice(0, 8),
    feedbackHealth: buildFeedbackHealth(tickets),
    knowledgeHealth: buildKnowledgeHealth(activeTickets, catalog?.knowledgeArticles ?? []),
    overallTone,
    overallLabel: overallTone === "success" ? "Governanca estavel" : "Atencao operacional",
    metrics: [
      {
        label: "Aprovacoes pendentes",
        value: String(pendingApprovals.length),
        detail: pendingApprovals.length ? "Bloqueiam fechamento seguro" : "Nenhuma revisao aberta",
        tone: pendingApprovals.length ? "warning" : "success",
        icon: ShieldCheck
      },
      {
        label: "Baixa confianca IA",
        value: String(lowConfidence.length),
        detail: "Triagens abaixo de 72%",
        tone: lowConfidence.length ? "warning" : "success",
        icon: Bot
      },
      {
        label: "SLA em risco",
        value: String(slaAttention.length),
        detail: "Vencido ou perto do vencimento",
        tone: slaAttention.length ? "danger" : "success",
        icon: Clock3
      },
      {
        label: "Rastreio com erro",
        value: String(traceErrors.length),
        detail: traces.length ? `${traces.length} spans analisados` : "Sem spans ainda",
        tone: traceErrors.length ? "danger" : "info",
        icon: Activity
      }
    ] satisfies GovernanceMetric[]
  };
}

function buildFeedbackHealth(tickets: Ticket[]) {
  const rows: FeedbackRow[] = tickets.flatMap((ticket) =>
    (ticket.ai.feedback ?? []).map((item) => ({
      id: item.id,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      ticketTitle: ticket.title,
      decision: item.decision,
      rating: item.rating,
      note: item.note,
      actorName: item.actorName,
      createdAt: item.createdAt
    }))
  );
  const total = rows.length;
  const useful = rows.filter((item) => item.rating === "useful").length;
  const needsReview = rows.filter((item) => item.rating === "needs_review").length;
  const incorrect = rows.filter((item) => item.rating === "incorrect").length;
  const triage = rows.filter((item) => item.decision === "triage").length;
  const resolutionDraft = rows.filter((item) => item.decision === "resolution_draft").length;
  const negative = needsReview + incorrect;
  const recent = rows.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 5);
  const tone = incorrect ? "danger" : needsReview ? "warning" : total ? "success" : "neutral";

  return {
    total,
    useful,
    needsReview,
    incorrect,
    triage,
    resolutionDraft,
    negative,
    recent,
    tone,
    recommendation: feedbackRecommendation(total, needsReview, incorrect),
    metrics: [
      {
        label: "Total",
        value: String(total),
        detail: total ? "Feedbacks registrados" : "Sem amostra ainda",
        tone: total ? "info" : "neutral"
      },
      {
        label: "Uteis",
        value: String(useful),
        detail: useful ? "Decisoes aceitas" : "Sem confirmacao",
        tone: useful ? "success" : "neutral"
      },
      {
        label: "Revisar",
        value: String(needsReview),
        detail: needsReview ? "Pedir ajuste humano" : "Nenhum caso",
        tone: needsReview ? "warning" : "success"
      },
      {
        label: "Incorretos",
        value: String(incorrect),
        detail: incorrect ? "Priorizar correcao" : "Nenhum erro marcado",
        tone: incorrect ? "danger" : "success"
      }
    ] satisfies Array<{ label: string; value: string; detail: string; tone: "danger" | "warning" | "info" | "success" | "neutral" }>
  };
}

function buildKnowledgeHealth(activeTickets: Ticket[], articles: ServiceDeskCatalog["knowledgeArticles"]) {
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const sourceUsage = new Map<string, { id: string; title: string; count: number; cataloged: boolean }>();
  const ticketsWithSources = activeTickets.filter((ticket) => ticket.ai.retrievedSources.length > 0);
  const missingSourceTickets = activeTickets.filter((ticket) => ticket.ai.retrievedSources.length === 0);

  activeTickets.forEach((ticket) => {
    ticket.ai.retrievedSources.forEach((source) => {
      const current = sourceUsage.get(source.id);
      sourceUsage.set(source.id, {
        id: source.id,
        title: source.title,
        count: (current?.count ?? 0) + 1,
        cataloged: articleById.has(source.id)
      });
    });
  });

  const usedSources = [...sourceUsage.values()];
  const catalogedUsed = usedSources.filter((source) => source.cataloged).length;
  const uncataloged = usedSources.length - catalogedUsed;
  const coveragePct = activeTickets.length ? Math.round((ticketsWithSources.length / activeTickets.length) * 100) : 0;
  const serviceGaps = rankServiceGaps(missingSourceTickets);
  const reviewArticles = articles.filter((article) => article.status === "needs_review" || isArticleStale(article)).slice(0, 5);
  const tone = uncataloged || serviceGaps.length || reviewArticles.length ? "warning" : "success";

  return {
    coveragePct,
    tone,
    topSources: usedSources.sort((left, right) => right.count - left.count).slice(0, 5),
    serviceGaps,
    reviewArticles,
    metrics: [
      {
        label: "Cobertura ativa",
        value: activeTickets.length ? `${coveragePct}%` : "0%",
        detail: activeTickets.length ? `${ticketsWithSources.length} de ${activeTickets.length} chamado(s)` : "Sem chamados ativos",
        tone: coveragePct >= 90 || !activeTickets.length ? "success" : coveragePct >= 60 ? "warning" : "danger",
        icon: FileSearch
      },
      {
        label: "Fontes catalogadas",
        value: `${catalogedUsed}/${usedSources.length}`,
        detail: uncataloged ? `${uncataloged} fonte(s) sem catalogo` : "Todas as fontes usadas tem catalogo",
        tone: uncataloged ? "warning" : "success",
        icon: Database
      },
      {
        label: "Revisao pendente",
        value: String(reviewArticles.length),
        detail: reviewArticles.length ? "Artigos vencidos ou marcados" : "Cadencia em dia",
        tone: reviewArticles.length ? "warning" : "success",
        icon: FileWarning
      }
    ] satisfies GovernanceMetric[]
  };
}

function rankServiceGaps(tickets: Ticket[]) {
  const counts = new Map<string, number>();
  tickets.forEach((ticket) => {
    counts.set(ticket.affectedService, (counts.get(ticket.affectedService) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([service, count]) => ({ service, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

function isArticleStale(article: ServiceDeskCatalog["knowledgeArticles"][number]): boolean {
  const updatedAt = new Date(article.updatedAt).getTime();
  const ageMs = Date.now() - updatedAt;
  return ageMs > article.reviewCadenceDays * 24 * 60 * 60 * 1000;
}

function buildRecommendations(input: {
  pendingApprovals: Ticket[];
  lowConfidence: Ticket[];
  slaAttention: Ticket[];
  missingRag: Ticket[];
  traceErrors: TraceSpan[];
  activeTickets: Ticket[];
  agentRuns: AgentAuditEntry[];
}): GovernanceRecommendation[] {
  const items: GovernanceRecommendation[] = [];

  if (input.slaAttention.length) {
    items.push({
      id: "sla-rescue",
      title: "Executar resgate de SLA",
      priority: input.slaAttention.some((ticket) => slaRisk(ticket) === "breached") ? "critical" : "high",
      evidence: `${input.slaAttention.length} chamado(s) vencido(s) ou perto do vencimento.`,
      action: "Revisar fila, atribuir dono e atualizar proxima acao."
    });
  }

  if (input.pendingApprovals.length) {
    items.push({
      id: "approval-queue",
      title: "Destravar revisoes humanas",
      priority: "high",
      evidence: `${input.pendingApprovals.length} chamado(s) aguardam decisao humana.`,
      action: "Aprovar, rejeitar ou registrar justificativa antes da resolucao."
    });
  }

  if (input.lowConfidence.length) {
    items.push({
      id: "intake-quality",
      title: "Melhorar qualidade de abertura",
      priority: "medium",
      evidence: `${input.lowConfidence.length} triagem(ns) abaixo de 72% de confianca.`,
      action: "Ajustar templates, perguntas obrigatorias e exemplos por servico."
    });
  }

  if (input.missingRag.length) {
    items.push({
      id: "rag-coverage",
      title: "Ampliar cobertura RAG",
      priority: "medium",
      evidence: `${input.missingRag.length} chamado(s) ativos sem fonte vinculada.`,
      action: "Criar ou revisar artigos para os servicos mais frequentes."
    });
  }

  if (input.traceErrors.length) {
    items.push({
      id: "trace-errors",
      title: "Inspecionar falhas de agentes",
      priority: "high",
      evidence: `${input.traceErrors.length} span(s) de erro nos rastros recentes.`,
      action: "Abrir traces com erro e revisar fallback/model gateway."
    });
  }

  if (!items.length) {
    items.push({
      id: "continuous-hardening",
      title: "Consolidar backlog de melhoria continua",
      priority: "low",
      evidence: `${input.activeTickets.length} chamado(s) ativo(s), ${input.agentRuns.length} evento(s) auditado(s).`,
      action: "Priorizar melhorias de reporting historico e tendencias."
    });
  }

  return items.sort((left, right) => recommendationWeight(right.priority) - recommendationWeight(left.priority));
}

function rankRiskTickets(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((left, right) => ticketRiskScore(right) - ticketRiskScore(left));
}

function ticketRiskScore(ticket: Ticket): number {
  let score = 0;
  if (ticket.priority === "critical") score += 50;
  if (ticket.priority === "high") score += 30;
  if (slaRisk(ticket) === "breached") score += 50;
  if (slaRisk(ticket) === "warning") score += 25;
  if (ticket.approvals.some((approval) => approval.status === "requested")) score += 20;
  if ((ticket.ai.triage?.confidence ?? 1) < 0.72) score += 15;
  if (!ticket.ai.retrievedSources.length) score += 10;
  return score;
}

function recommendationWeight(priority: RecommendationPriority): number {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

export function recommendationTone(priority: RecommendationPriority): "danger" | "warning" | "info" | "neutral" {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

export function recommendationLabel(priority: RecommendationPriority): string {
  if (priority === "critical") return "Critica";
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  return "Baixa";
}

export function evalReportTone(report: ServiceDeskEvalReport | null): "danger" | "warning" | "success" | "neutral" {
  if (!report) return "warning";
  if (report.failedCases > 0) return "danger";
  if (report.passRate < 100) return "warning";
  return "success";
}

export function evalCaseTitle(item: ServiceDeskEvalCaseReport): string {
  const titles: Record<string, string> = {
    "erp-critical-approval": "ERP critico com aprovacao humana",
    "weak-intake-blocked": "Abertura vaga bloqueada",
    "identity-self-service": "Senha e MFA com autoatendimento"
  };
  return titles[item.id] ?? item.name;
}

export function evalCaseDetail(item: ServiceDeskEvalCaseReport): string {
  const failed = item.scorers.filter((scorer) => !scorer.passed);
  if (!failed.length) return `${item.scorers.length} verificacoes passaram; ${item.observedSpans.length} spans observados.`;
  return failed.map((scorer) => `${scorerLabel(scorer.id)}: ${scorer.reason}`).join("; ");
}

function scorerLabel(id: string): string {
  const labels: Record<string, string> = {
    "intake-outcome": "Intake",
    "ticket-outcome": "Chamado",
    "rag-grounding": "RAG",
    "workflow-trajectory": "Trajetoria",
    "suite-error": "Suite"
  };
  return labels[id] ?? id;
}

function feedbackRecommendation(total: number, needsReview: number, incorrect: number): string {
  if (!total) return "Incentivar analistas a classificar decisoes de IA nos chamados tratados.";
  if (incorrect) return "Revisar exemplos incorretos e promover os casos para evals regressivos.";
  if (needsReview) return "Agrupar feedbacks de revisao para ajustar prompts, RAG ou criterios de prioridade.";
  return "Manter coleta ativa para detectar degradacao antes de impacto operacional.";
}

export function feedbackDecisionLabel(decision: FeedbackRow["decision"]): string {
  return decision === "resolution_draft" ? "Rascunho" : "Triagem";
}

export function feedbackRatingLabel(rating: FeedbackRow["rating"]): string {
  if (rating === "useful") return "Util";
  if (rating === "needs_review") return "Revisar";
  return "Incorreto";
}

export function feedbackRatingTone(rating: FeedbackRow["rating"]): "success" | "warning" | "danger" {
  if (rating === "useful") return "success";
  if (rating === "needs_review") return "warning";
  return "danger";
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(new Date(value));
}

