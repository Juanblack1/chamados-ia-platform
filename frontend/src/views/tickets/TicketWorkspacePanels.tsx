import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  ShieldCheck,
  X
} from "lucide-react";
import type { Ticket, TicketAiFeedback, TicketApproval, TraceSpan } from "../../lib/api";
import { localizeAgentContent } from "../../lib/aiText";
import { Badge } from "../../components/common";
export function TicketAssistantChatFallback() {
  return (
    <section className="panel assistant-chat-panel" aria-labelledby="ticket-chat-loading-title">
      <div className="panel-heading">
        <div>
          <h2 id="ticket-chat-loading-title">Chat do chamado</h2>
          <p>Carregando agente especialista.</p>
        </div>
        <Badge tone="neutral">assistant-ui</Badge>
      </div>
      <div className="stream-status" aria-live="polite">
        <Loader2 className="spin" size={15} />
        <span>Preparando chat</span>
      </div>
    </section>
  );
}

export function AiFeedbackPanel({
  feedback,
  isSubmitting,
  onSubmit
}: {
  feedback: TicketAiFeedback[];
  isSubmitting: boolean;
  onSubmit: (rating: TicketAiFeedback["rating"], note?: string) => void;
}) {
  const triageFeedback = feedback.filter((item) => item.decision === "triage");
  const latest = triageFeedback[triageFeedback.length - 1];
  const [rating, setRating] = useState<TicketAiFeedback["rating"]>("useful");
  const [note, setNote] = useState("");

  function submit() {
    onSubmit(rating, note.trim() || undefined);
    setNote("");
  }

  return (
    <div className="ai-feedback-panel" aria-label="Feedback da decisao da IA">
      <div className="ai-feedback-heading">
        <strong>Feedback da IA</strong>
        <Badge tone={latest ? aiFeedbackTone(latest.rating) : "neutral"}>{latest ? aiFeedbackLabel(latest.rating) : "Sem feedback"}</Badge>
      </div>
      <div className="ai-feedback-options" role="group" aria-label="Classificar decisao da IA">
        {[
          { value: "useful" as const, label: "Util", icon: CheckCircle2 },
          { value: "needs_review" as const, label: "Revisar", icon: AlertTriangle },
          { value: "incorrect" as const, label: "Incorreta", icon: X }
        ].map((option) => {
          const Icon = option.icon;
          return (
            <button
              type="button"
              key={option.value}
              className={rating === option.value ? "active" : ""}
              onClick={() => setRating(option.value)}
              aria-pressed={rating === option.value}
            >
              <Icon size={15} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional para melhorar proximas avaliacoes" />
      <div className="ai-feedback-footer">
        {latest ? (
          <small>
            Ultimo: {latest.actorName} marcou {aiFeedbackLabel(latest.rating).toLowerCase()}
            {latest.note ? ` - ${latest.note}` : ""}
          </small>
        ) : <small>Use apos revisar resumo, evidencia e prioridade sugerida.</small>}
        <button type="button" className="secondary-button small" disabled={isSubmitting} onClick={submit}>
          <Save size={15} />
          <span>Registrar</span>
        </button>
      </div>
    </div>
  );
}

export function AiTraceabilityPanel({ ticket, traces, canWork }: { ticket: Ticket; traces: TraceSpan[]; canWork: boolean }) {
  const triage = ticket.ai.triage;
  const draft = ticket.ai.resolutionDraft;
  const traceId = metadataString(triage?.metadata, "traceId") ?? metadataString(draft?.metadata, "traceId");
  const visibleSpans = traceId ? traces.filter((span) => span.traceId === traceId).slice(0, 5) : [];
  const modelRoute = metadataString(triage?.metadata, "modelRoute") ?? metadataString(draft?.metadata, "modelRoute") ?? "Sem rota registrada";
  const executionMode = metadataString(triage?.metadata, "executionMode") ?? metadataString(draft?.metadata, "executionMode") ?? "desconhecido";
  const hasPendingApproval = ticket.approvals.some((approval) => approval.status === "requested");
  const policyStatus = hasPendingApproval ? "Revisao humana pendente" : triage ? "Politica atendida" : "Aguardando decisao";
  const override = canWork ? "Feedback, status e aprovacao disponiveis" : "Somente leitura para este perfil";

  return (
    <section className="panel ai-traceability-panel" aria-labelledby="traceability-title">
      <div className="panel-heading">
        <div>
          <h2 id="traceability-title">Rastreabilidade IA</h2>
          <p>Trace, rota de modelo, escopo e controle humano.</p>
        </div>
        <Badge tone={hasPendingApproval ? "warning" : traceId ? "success" : "neutral"}>{traceId ? "Trace vinculado" : "Sem trace"}</Badge>
      </div>
      <div className="traceability-grid">
        <div>
          <span>Trace ID</span>
          <strong>{traceId ?? "Nao registrado"}</strong>
        </div>
        <div>
          <span>Rota do modelo</span>
          <strong>{modelRoute}</strong>
        </div>
        <div>
          <span>Modo</span>
          <strong>{executionMode === "deterministic-fallback" ? "Fallback local" : executionMode}</strong>
        </div>
        <div>
          <span>Escopo</span>
          <strong>{requestSourceLabel(ticket.requestSource)} - {ticket.entityName}</strong>
        </div>
        <div>
          <span>Politica</span>
          <strong>{policyStatus}</strong>
        </div>
        <div>
          <span>Override humano</span>
          <strong>{override}</strong>
        </div>
      </div>
      <div className="trace-list compact">
        {visibleSpans.length ? visibleSpans.map((span) => (
          <div className={`trace-row ${span.status}`} key={span.id}>
            <span>{span.kind}</span>
            <strong>{span.name}</strong>
            <small>{span.durationMs} ms</small>
          </div>
        )) : <small>Nenhum span encontrado para este trace.</small>}
      </div>
    </section>
  );
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function requestSourceLabel(source: Ticket["requestSource"]): string {
  if (source === "api") return "API";
  if (source === "chat") return "Chat";
  if (source === "email") return "Email";
  if (source === "phone") return "Telefone";
  return "Portal";
}

function aiFeedbackLabel(rating: TicketAiFeedback["rating"]): string {
  if (rating === "useful") return "Util";
  if (rating === "needs_review") return "Revisar";
  return "Incorreta";
}

function aiFeedbackTone(rating: TicketAiFeedback["rating"]): "success" | "warning" | "danger" {
  if (rating === "useful") return "success";
  if (rating === "needs_review") return "warning";
  return "danger";
}

export function ApprovalPanel({
  approvals,
  canWork,
  isSubmitting,
  onApproval
}: {
  approvals: TicketApproval[];
  canWork: boolean;
  isSubmitting: boolean;
  onApproval: (decision: "approved" | "rejected", note?: string) => void;
}) {
  const [note, setNote] = useState("");
  const pending = approvals.find((approval) => approval.status === "requested");

  if (!approvals.length) return null;

  return (
    <div className="approval-panel">
      <div className="approval-panel-heading">
        <div className="heading-inline">
          <ShieldCheck size={18} />
          <h3>Revisao humana</h3>
        </div>
        <Badge tone={pending ? "warning" : approvals.some((approval) => approval.status === "rejected") ? "danger" : "success"}>
          {pending ? "Pendente" : "Decidida"}
        </Badge>
      </div>
      <div className="approval-list">
        {approvals.map((approval) => (
          <article className={`approval-card ${approval.status}`} key={approval.id}>
            <div>
              <strong>{approvalStatusLabel(approval.status)}</strong>
              <span>{approval.requesterName} - {formatTimelineDate(approval.createdAt)}</span>
            </div>
            <p>{approval.reason ?? "Revisao solicitada para decisao de IA."}</p>
            {approval.decidedAt ? (
              <small>
                {approval.decidedByName ?? "Operador"} em {formatTimelineDate(approval.decidedAt)}
                {approval.decisionNote ? ` - ${approval.decisionNote}` : ""}
              </small>
            ) : null}
          </article>
        ))}
      </div>
      {pending && canWork ? (
        <div className="approval-actions">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional para auditoria da decisao" />
          <div className="inline-actions end">
            <button type="button" className="secondary-button small" disabled={isSubmitting} onClick={() => { onApproval("rejected", note); setNote(""); }}>
              <X size={16} />
              <span>Rejeitar</span>
            </button>
            <button type="button" className="primary-button small" disabled={isSubmitting} onClick={() => { onApproval("approved", note); setNote(""); }}>
              <CheckCircle2 size={16} />
              <span>Aprovar</span>
            </button>
          </div>
        </div>
      ) : pending ? (
        <p className="approval-hint">Aguardando decisao de um analista autorizado.</p>
      ) : null}
    </div>
  );
}

function approvalStatusLabel(status: TicketApproval["status"]): string {
  if (status === "requested") return "Aguardando decisao";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  return "Nao requerida";
}

type TimelineDisplayEvent = {
  id: string;
  actor: Ticket["timeline"][number]["actor"];
  actorLabel: string;
  message: string;
  createdAt: string;
  visibility?: "public" | "internal";
};

export function buildTimelineEvents(ticket: Ticket): TimelineDisplayEvent[] {
  const baseEvents = ticket.timeline.map((event): TimelineDisplayEvent => ({
    id: event.id,
    actor: event.actor,
    actorLabel: timelineActorLabel(event.actor),
    message: event.message,
    createdAt: event.createdAt
  }));
  const followupEvents: TimelineDisplayEvent[] = ticket.followups.map((item) => ({
    id: item.id,
    actor: item.visibility === "internal" ? "technician" : "requester",
    actorLabel: item.visibility === "internal" ? "Tecnico" : "Solicitante",
    message: item.message,
    createdAt: item.createdAt,
    visibility: item.visibility
  }));
  const deduped = new Map<string, TimelineDisplayEvent>();

  [...baseEvents, ...followupEvents].forEach((event) => {
    const key = `${event.actor}|${event.createdAt}|${event.message}`;
    deduped.set(key, event);
  });

  return [...deduped.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function timelineActorLabel(actor: TimelineDisplayEvent["actor"]): string {
  if (actor === "requester") return "Solicitante";
  if (actor === "technician") return "Tecnico";
  if (actor === "analyst") return "Analista";
  if (actor === "agent") return "Agente IA";
  return "Sistema";
}

export function formatTimelineDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function localizeTimelineMessage(message: string): string {
  const localized = localizeAgentContent(message);
  if (localized !== message) return localized;

  if (/^Routing agent assigned/i.test(message)) {
    return message
      .replace(/^Routing agent assigned/i, "Agente de roteamento direcionou")
      .replace(/\bto\b/i, "para");
  }

  if (/^SLA risk agent marked risk as/i.test(message)) {
    return message
      .replace(/^SLA risk agent marked risk as/i, "Agente de SLA marcou risco")
      .replace(/\bnormal\b/g, "normal")
      .replace(/\bwatch\b/g, "em observacao")
      .replace(/\bescalate\b/g, "de escalacao")
      .replace(/\bfor\b/i, "para")
      .replace(/\bpriority\b/i, "prioridade")
      .replace(/\bEvidence:/i, "Evidencia:");
  }

  if (/^I understand you're experiencing/i.test(message)) {
    return "Entendi que ha um problema de login. Para avancar, confirme o tipo de falha, a mensagem de erro completa, o usuario afetado e a validacao de identidade.";
  }

  return message
    .replace(/\bpriority critical\b/gi, "prioridade critica")
    .replace(/\bpriority high\b/gi, "prioridade alta")
    .replace(/\bpriority medium\b/gi, "prioridade media")
    .replace(/\bpriority low\b/gi, "prioridade baixa")
    .replace(/\bcritical priority\b/gi, "prioridade critica")
    .replace(/\bhigh priority\b/gi, "prioridade alta")
    .replace(/\bmedium priority\b/gi, "prioridade media")
    .replace(/\blow priority\b/gi, "prioridade baixa");
}


