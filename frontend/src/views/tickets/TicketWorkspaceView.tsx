import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, LifeBuoy, LockKeyhole, Plus, Send, Trash2, UserRound } from "lucide-react";
import type {
  AppUser,
  ServiceDeskCatalog,
  Ticket,
  TicketAiFeedback,
  TicketChatStreamEvent,
  TicketStatus,
  TraceSpan
} from "../../lib/api";
import { localizeAgentContent } from "../../lib/aiText";
import { hasPermission, priorityLabel, priorityTone, statusLabel, statusTone, typeLabel } from "../../lib/presentation";
import { AnalysisItem, Badge, SlaBadge } from "../../components/common";
import {
  AiFeedbackPanel,
  AiTraceabilityPanel,
  ApprovalPanel,
  TicketAssistantChatFallback,
  buildTimelineEvents,
  formatTimelineDate,
  localizeTimelineMessage
} from "./TicketWorkspacePanels";

const TicketAssistantChat = lazy(() => import("../../components/TicketAssistantChat"));
export function TicketWorkspaceView({
  user,
  ticket,
  catalog,
  traces,
  isSubmitting,
  onAssign,
  onStatus,
  onFollowup,
  onTask,
  onCompleteTask,
  onResolve,
  onApproval,
  onAiFeedback,
  onDelete,
  onTicketUpdated,
  onChat
}: {
  user: AppUser;
  ticket: Ticket;
  catalog: ServiceDeskCatalog | null;
  traces: TraceSpan[];
  isSubmitting: boolean;
  onAssign: (assigneeId?: string) => void;
  onStatus: (status: TicketStatus) => void;
  onFollowup: (message: string, visibility: "public" | "internal") => void;
  onTask: (title: string, description?: string) => void;
  onCompleteTask: (taskId: string) => void;
  onResolve: (message: string) => void;
  onApproval: (decision: "approved" | "rejected", note?: string) => void;
  onAiFeedback: (decision: TicketAiFeedback["decision"], rating: TicketAiFeedback["rating"], note?: string) => void;
  onDelete: () => void;
  onTicketUpdated: (ticket: Ticket) => void;
  onChat: (message: string, onEvent: (event: TicketChatStreamEvent) => void) => Promise<void>;
}) {
  const [followup, setFollowup] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [resolution, setResolution] = useState(ticket.ai.resolutionDraft?.summary ?? "");
  const canWork = hasPermission(user, "tickets.work");
  const canDelete = hasPermission(user, "tickets.delete");
  const timelineEvents = useMemo(() => buildTimelineEvents(ticket), [ticket]);
  const aiDecision = ticket.ai.triage ?? ticket.ai.resolutionDraft;
  const aiConfidence = aiDecision ? Math.round(aiDecision.confidence * 100) : 0;
  const openTasks = ticket.tasks.filter((task) => task.status !== "done").length;
  const doneTasks = ticket.tasks.length - openTasks;
  const memoryCount = ticket.ai.agentMemory?.filter((entry) => entry.role !== "system").length ?? 0;
  const pendingApproval = ticket.approvals.find((approval) => approval.status === "requested");
  const assignableUsers = useMemo(
    () => (catalog?.users ?? []).filter((candidate) => canAssignTicketToUser(ticket, candidate)),
    [catalog?.users, ticket.assignedGroupId, ticket.entityId]
  );
  const statusOptions: Array<{ value: TicketStatus; label: string }> = [
    { value: "new", label: "Novo" },
    { value: "open", label: "Aberto" },
    { value: "triaging", label: "Em triagem" },
    { value: "in_progress", label: "Em atendimento" },
    { value: "waiting_customer", label: "Aguardando solicitante" },
    { value: "pending_approval", label: "Aguardando aprovacao" },
    { value: "escalated", label: "Escalado" },
    { value: "resolved", label: "Resolvido" },
    { value: "closed", label: "Fechado" }
  ];

  useEffect(() => {
    setFollowup("");
    setTaskTitle("");
    setResolution(ticket.ai.resolutionDraft?.summary ?? "");
  }, [ticket.id, ticket.ai.resolutionDraft?.summary]);

  return (
    <section className="detail-layout ticket-workspace" aria-label="Detalhe e tratamento do chamado">
      <div className="ticket-workspace-header panel">
        <div className="ticket-title-block">
          <p className="eyebrow">{ticket.number} - {typeLabel(ticket.type)}</p>
          <h2>{ticket.title}</h2>
          <p>{ticket.description}</p>
          <div className="ticket-header-meta">
            <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
            <Badge tone={priorityTone(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>
            <SlaBadge ticket={ticket} />
          </div>
        </div>
        <div className="ticket-header-actions">
          <label className="status-control">
            <span>Status</span>
            <select className="status-select" value={ticket.status} disabled={!canWork || isSubmitting} onChange={(event) => onStatus(event.target.value as TicketStatus)}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="status-control assignee-control">
            <span>Tecnico</span>
            <select
              className="status-select"
              value={ticket.assigneeId ?? ""}
              disabled={!canWork || isSubmitting || assignableUsers.length === 0}
              onChange={(event) => {
                if (event.target.value) onAssign(event.target.value);
              }}
            >
              <option value="">Nao atribuido</option>
              {assignableUsers.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
            </select>
          </label>
          <div className="inline-actions end">
            {canWork ? (
              <button type="button" className="secondary-button small" disabled={isSubmitting} onClick={() => onAssign()}>
                <UserRound size={16} />
                <span>Atribuir para mim</span>
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className="danger-button small" disabled={isSubmitting} onClick={onDelete}>
                <Trash2 size={16} />
                <span>Excluir</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ticket-context-grid" aria-label="Resumo operacional">
        <article className="ticket-context-card">
          <span className="context-icon"><UserRound size={16} /></span>
          <div>
            <span>Solicitante</span>
            <strong>{ticket.requesterEmail}</strong>
            <small>{ticket.department || ticket.entityName}</small>
          </div>
        </article>
        <article className="ticket-context-card">
          <span className="context-icon"><Activity size={16} /></span>
          <div>
            <span>Servico afetado</span>
            <strong>{ticket.affectedService}</strong>
            <small>{ticket.category}</small>
          </div>
        </article>
        <article className="ticket-context-card">
          <span className="context-icon"><LifeBuoy size={16} /></span>
          <div>
            <span>Tratamento</span>
            <strong>{ticket.assignedGroupName ?? "Sem grupo"}</strong>
            <small>{ticket.assigneeName ?? "Nao atribuido"}</small>
          </div>
        </article>
        <article className="ticket-context-card">
          <span className="context-icon"><Bot size={16} /></span>
          <div>
            <span>IA</span>
            <strong>{aiConfidence ? `${aiConfidence}% de confianca` : "Sem decisao"}</strong>
            <small>{memoryCount} memorias no chamado</small>
          </div>
        </article>
      </div>

      <div className="ticket-workspace-grid">
        <aside className="ticket-insight-column">
          <section className="panel ai-context-panel" aria-labelledby="ai-context-title">
            <div className="panel-heading">
              <div>
                <h2 id="ai-context-title">Contexto da IA</h2>
                <p>Classificacao, impacto e evidencias usadas pelos agentes.</p>
              </div>
              <Badge tone={ticket.ai.triage ? "success" : "neutral"}>{ticket.ai.triage ? "Triado" : "Pendente"}</Badge>
            </div>
            <div className="ai-context-body">
              <AnalysisItem label="Tipo" value={typeLabel(ticket.type)} />
              <AnalysisItem label="Urgencia" value={priorityLabel(ticket.urgency)} />
              <AnalysisItem label="Impacto operacional" value={priorityLabel(ticket.impact)} />
              <AnalysisItem label="Impacto negocio" value={ticket.businessImpact || "Nao informado"} />
              <AnalysisItem label="Tags" value={ticket.tags.join(", ") || "Sem tags"} />
            </div>
            {aiDecision ? (
              <article className="ai-decision-card">
                <div className="ai-decision-header">
                  <strong>{aiDecision.agent}</strong>
                  <Badge tone={aiConfidence >= 80 ? "success" : "warning"}>{aiConfidence}%</Badge>
                </div>
                <p>{localizeAgentContent(aiDecision.summary)}</p>
                {aiDecision.evidence.length ? (
                  <ul>
                    {aiDecision.evidence.slice(0, 4).map((evidence) => <li key={evidence}>{localizeAgentContent(evidence)}</li>)}
                  </ul>
                ) : null}
                {canWork ? (
                  <AiFeedbackPanel
                    feedback={ticket.ai.feedback ?? []}
                    isSubmitting={isSubmitting}
                    onSubmit={(rating, note) => onAiFeedback("triage", rating, note)}
                  />
                ) : null}
              </article>
            ) : null}
          </section>

          <AiTraceabilityPanel ticket={ticket} traces={traces} canWork={canWork} />

          <section className="panel evidence-panel" aria-labelledby="evidence-title">
            <div className="panel-heading">
              <div>
                <h2 id="evidence-title">Fontes e anexos</h2>
                <p>Base consultada e provas enviadas pelo solicitante.</p>
              </div>
              <Badge tone="info">{ticket.ai.retrievedSources.length} fontes</Badge>
            </div>
            <div className="evidence-grid compact">
              {ticket.ai.retrievedSources.length ? ticket.ai.retrievedSources.slice(0, 4).map((source) => (
                <article key={source.id} className="evidence-row compact">
                  <div>
                    <strong>{source.title}</strong>
                    <span>{source.source}</span>
                  </div>
                  <p>{source.excerpt}</p>
                  <Badge tone="neutral">{Math.round(source.relevance * 100)}%</Badge>
                </article>
              )) : <p className="empty-inline">Nenhuma fonte RAG vinculada.</p>}
            </div>
            {ticket.attachments.length ? (
              <div className="ticket-attachments">
                <h3>Anexos</h3>
                <div className="attachment-grid">
                  {ticket.attachments.map((attachment, index) => (
                    <a className="attachment-thumb" href={attachment} target="_blank" rel="noreferrer" key={attachment}>
                      <img src={attachment} alt={`Evidencia ${index + 1}`} />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </aside>

        <section className="panel timeline-panel treatment-timeline" aria-labelledby="timeline-title">
          <div className="panel-heading">
            <div>
              <h2 id="timeline-title">Acompanhamentos</h2>
              <p>Historico visivel, comentarios internos e resposta dos agentes em pt-BR.</p>
            </div>
            <Badge tone="neutral">{timelineEvents.length} eventos</Badge>
          </div>
          <div className="timeline">
            {timelineEvents.map((event) => (
              <article key={event.id} className={`timeline-item ${event.actor}`}>
                <div className="timeline-meta">
                  <strong>{event.actorLabel}</strong>
                  <time dateTime={event.createdAt}>{formatTimelineDate(event.createdAt)}</time>
                  {event.visibility ? <Badge tone={event.visibility === "internal" ? "warning" : "info"}>{event.visibility === "internal" ? "Interno" : "Visivel"}</Badge> : null}
                </div>
                <p>{localizeTimelineMessage(event.message)}</p>
              </article>
            ))}
          </div>
          <div className="composer">
            <textarea value={followup} onChange={(event) => setFollowup(event.target.value)} placeholder="Registrar acompanhamento para o solicitante ou equipe interna" />
            <div className="inline-actions end">
              {canWork ? (
                <button type="button" className="secondary-button small" disabled={isSubmitting || followup.trim().length < 3} onClick={() => { onFollowup(followup, "internal"); setFollowup(""); }}>
                  <LockKeyhole size={16} />
                  <span>Salvar interno</span>
                </button>
              ) : null}
              <button type="button" className="primary-button small" disabled={isSubmitting || followup.trim().length < 3} onClick={() => { onFollowup(followup, "public"); setFollowup(""); }}>
                <Send size={16} />
                <span>Publicar acompanhamento</span>
              </button>
            </div>
          </div>
        </section>

        <aside className="ticket-treatment-column">
          <section className="panel treatment-panel" aria-labelledby="treatment-title">
            <div className="panel-heading">
              <div>
                <h2 id="treatment-title">Tratamento</h2>
                <p>Plano tecnico, tarefas e fechamento do chamado.</p>
              </div>
              <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
            </div>
            <div className="treatment-stats">
              <span><strong>{openTasks}</strong>Tarefas abertas</span>
              <span><strong>{doneTasks}</strong>Concluidas</span>
              <span><strong>{formatTimelineDate(ticket.updatedAt)}</strong>Atualizado</span>
            </div>
            <ApprovalPanel
              approvals={ticket.approvals}
              canWork={canWork}
              isSubmitting={isSubmitting}
              onApproval={onApproval}
            />
            <div className="task-list treatment-task-list">
              <h3>Plano de acao</h3>
              {ticket.tasks.length ? ticket.tasks.map((task) => (
                <label key={task.id} className="task-row">
                  <input type="checkbox" checked={task.status === "done"} disabled={!canWork || task.status === "done"} onChange={() => onCompleteTask(task.id)} />
                  <span>{task.title}</span>
                  <Badge tone={task.status === "done" ? "success" : task.status === "doing" ? "info" : "neutral"}>
                    {task.status === "done" ? "Concluida" : task.status === "doing" ? "Em execucao" : "A fazer"}
                  </Badge>
                </label>
              )) : <p>Nenhuma tarefa registrada.</p>}
              {canWork ? (
                <div className="task-composer">
                  <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Nova tarefa tecnica" />
                  <button type="button" className="secondary-button small" disabled={isSubmitting || taskTitle.trim().length < 3} onClick={() => { onTask(taskTitle); setTaskTitle(""); }}>
                    <Plus size={16} />
                    <span>Criar tarefa</span>
                  </button>
                </div>
              ) : null}
            </div>
            {canWork ? (
              <div className="resolution-box">
                <h3>Solucao</h3>
                <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Descreva a solucao aplicada e o resultado validado" />
                {pendingApproval ? <p className="approval-hint">A solucao so pode ser publicada depois da revisao humana.</p> : null}
                <button type="button" className="primary-button small" disabled={isSubmitting || resolution.trim().length < 6 || Boolean(pendingApproval)} onClick={() => onResolve(resolution)}>
                  <CheckCircle2 size={16} />
                  <span>Resolver chamado</span>
                </button>
              </div>
            ) : null}
          </section>
          <Suspense fallback={<TicketAssistantChatFallback />}>
            <TicketAssistantChat ticket={ticket} onTicketUpdated={onTicketUpdated} onChat={onChat} />
          </Suspense>
        </aside>
      </div>
    </section>
  );
}

function canAssignTicketToUser(ticket: Ticket, target: AppUser): boolean {
  if (!target.active || !hasPermission(target, "tickets.work")) return false;
  if (target.entityId !== ticket.entityId) return false;
  if (!ticket.assignedGroupId) return true;
  return target.groupIds.includes(ticket.assignedGroupId);
}


