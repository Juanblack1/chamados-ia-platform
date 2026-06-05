import { useMemo, type KeyboardEvent } from "react";
import { Activity, AlertTriangle, Bot, Clock3, FileSearch, TicketCheck, UserCheck, UsersRound } from "lucide-react";
import type { Ticket } from "../../lib/api";
import { priorityLabel, priorityTone, slaRisk, statusLabel, statusTone, typeLabel } from "../../lib/presentation";
import { Badge, SkeletonRows, SlaBadge } from "../../components/common";

const LOW_CONFIDENCE_THRESHOLD = 0.72;

type GroupWorkloadRow = {
  id: string;
  name: string;
  active: number;
  critical: number;
  slaAttention: number;
  lowConfidence: number;
  unassigned: number;
};

type AssigneeWorkloadRow = {
  id: string;
  name: string;
  groupName: string;
  active: number;
  critical: number;
  slaAttention: number;
};

type WorkloadModel = {
  activeCount: number;
  unassignedCount: number;
  groups: GroupWorkloadRow[];
  assignees: AssigneeWorkloadRow[];
};

export function QueueView({
  tickets,
  allTickets,
  isLoading,
  selectedId,
  onSelect
}: {
  tickets: Ticket[];
  allTickets: Ticket[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (ticket: Ticket) => void;
}) {
  const metrics = useMemo(() => {
    const active = allTickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
    const breached = allTickets.filter((ticket) => slaRisk(ticket) === "breached").length;
    const critical = allTickets.filter((ticket) => ticket.priority === "critical").length;
    const confidenceItems = allTickets.map((ticket) => ticket.ai.triage?.confidence ?? 0).filter(Boolean);
    const confidence = confidenceItems.length
      ? Math.round((confidenceItems.reduce((sum, value) => sum + value, 0) / confidenceItems.length) * 100)
      : 0;

    return [
      { label: "Ativos", value: active.toString(), icon: TicketCheck },
      { label: "SLA vencido", value: breached.toString(), icon: Clock3 },
      { label: "Criticos", value: critical.toString(), icon: AlertTriangle },
      { label: "Confianca IA", value: `${confidence}%`, icon: Bot }
    ];
  }, [allTickets]);

  const workload = useMemo(() => buildWorkloadModel(allTickets), [allTickets]);

  return (
    <section className="queue-layout" aria-label="Fila operacional">
      <MetricStrip metrics={metrics} />
      <WorkloadPanel model={workload} />
      <div className="content-grid">
        <section className="panel queue-panel" aria-labelledby="queue-title">
          <div className="panel-heading">
            <div>
              <h2 id="queue-title">Chamados</h2>
              <p>Fila com SLA, atribuicao, prioridade e proveniencia da IA.</p>
            </div>
            <Badge tone="neutral">{tickets.length} registros</Badge>
          </div>
          {isLoading ? <SkeletonRows /> : <TicketTable tickets={tickets} selectedId={selectedId} onSelect={onSelect} />}
        </section>
      </div>
    </section>
  );
}

function WorkloadPanel({ model }: { model: WorkloadModel }) {
  return (
    <section className="panel workload-panel" aria-labelledby="workload-title">
      <div className="panel-heading">
        <div className="heading-inline">
          <UsersRound size={19} />
          <div>
            <h2 id="workload-title">Distribuicao de carga</h2>
            <p>Chamados ativos por grupo, tecnico e risco operacional.</p>
          </div>
        </div>
        <Badge tone={model.unassignedCount ? "warning" : "success"}>{model.unassignedCount} sem tecnico</Badge>
      </div>

      {model.activeCount === 0 ? (
        <div className="workload-empty">
          <TicketCheck size={22} />
          <div>
            <strong>Sem carga ativa</strong>
            <span>Os chamados autorizados estao resolvidos ou fechados.</span>
          </div>
        </div>
      ) : (
        <div className="workload-grid">
          <section aria-labelledby="group-load-title">
            <div className="workload-section-heading">
              <h3 id="group-load-title">Carga por grupo</h3>
              <span>{model.groups.length} grupos</span>
            </div>
            <div className="workload-list">
              {model.groups.map((row) => (
                <div className="workload-row" key={row.id}>
                  <div className="workload-row-main">
                    <strong>{row.name}</strong>
                    <small>{row.active} ativo(s) - {row.unassigned} sem tecnico</small>
                  </div>
                  <div className="workload-counters" aria-label={`Indicadores de ${row.name}`}>
                    <Counter label="Criticos" value={row.critical} tone={row.critical ? "danger" : "neutral"} />
                    <Counter label="SLA" value={row.slaAttention} tone={row.slaAttention ? "warning" : "success"} />
                    <Counter label="IA baixa" value={row.lowConfidence} tone={row.lowConfidence ? "warning" : "success"} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="assignee-load-title">
            <div className="workload-section-heading">
              <div className="heading-inline">
                <UserCheck size={17} />
                <h3 id="assignee-load-title">Carga por tecnico</h3>
              </div>
              <span>{model.assignees.length} tecnicos</span>
            </div>
            {model.assignees.length ? (
              <div className="workload-list">
                {model.assignees.map((row) => (
                  <div className="workload-row compact" key={row.id}>
                    <div className="workload-row-main">
                      <strong>{row.name}</strong>
                      <small>{row.groupName}</small>
                    </div>
                    <div className="workload-counters compact" aria-label={`Indicadores de ${row.name}`}>
                      <Counter label="Ativos" value={row.active} tone="info" />
                      <Counter label="Criticos" value={row.critical} tone={row.critical ? "danger" : "neutral"} />
                      <Counter label="SLA" value={row.slaAttention} tone={row.slaAttention ? "warning" : "success"} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="workload-empty compact">
                <UserCheck size={20} />
                <div>
                  <strong>Sem tecnicos atribuidos</strong>
                  <span>Distribua chamados pela tela de tratamento para acompanhar carga individual.</span>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className={`workload-counter ${tone}`}>
      <strong>{value}</strong>
      {label}
    </span>
  );
}

function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string; icon: typeof Activity }> }) {
  return (
    <div className="metric-strip" aria-label="Metricas da fila">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div className="metric" key={metric.label}>
            <Icon size={18} />
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function buildWorkloadModel(tickets: Ticket[]): WorkloadModel {
  const activeTickets = tickets.filter(isActiveTicket);
  const groups = new Map<string, GroupWorkloadRow>();
  const assignees = new Map<string, AssigneeWorkloadRow>();

  activeTickets.forEach((ticket) => {
    const groupId = ticket.assignedGroupId ?? "unassigned-group";
    const group = groups.get(groupId) ?? {
      id: groupId,
      name: ticket.assignedGroupName ?? "Sem grupo",
      active: 0,
      critical: 0,
      slaAttention: 0,
      lowConfidence: 0,
      unassigned: 0
    };

    group.active += 1;
    if (ticket.priority === "critical") group.critical += 1;
    if (slaRisk(ticket) !== "ok") group.slaAttention += 1;
    if ((ticket.ai.triage?.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD) group.lowConfidence += 1;
    if (!ticket.assigneeId) group.unassigned += 1;
    groups.set(groupId, group);

    if (!ticket.assigneeId) return;

    const assignee = assignees.get(ticket.assigneeId) ?? {
      id: ticket.assigneeId,
      name: ticket.assigneeName ?? "Tecnico sem nome",
      groupName: ticket.assignedGroupName ?? "Sem grupo",
      active: 0,
      critical: 0,
      slaAttention: 0
    };
    assignee.active += 1;
    if (ticket.priority === "critical") assignee.critical += 1;
    if (slaRisk(ticket) !== "ok") assignee.slaAttention += 1;
    assignees.set(ticket.assigneeId, assignee);
  });

  return {
    activeCount: activeTickets.length,
    unassignedCount: activeTickets.filter((ticket) => !ticket.assigneeId).length,
    groups: [...groups.values()].sort(sortWorkloadRows).slice(0, 6),
    assignees: [...assignees.values()].sort(sortWorkloadRows).slice(0, 6)
  };
}

function isActiveTicket(ticket: Ticket) {
  return ticket.status !== "resolved" && ticket.status !== "closed";
}

function sortWorkloadRows<T extends { active: number; critical: number; slaAttention: number; name: string }>(left: T, right: T) {
  return (
    right.slaAttention - left.slaAttention ||
    right.critical - left.critical ||
    right.active - left.active ||
    left.name.localeCompare(right.name)
  );
}

function TicketTable({ tickets, selectedId, onSelect }: { tickets: Ticket[]; selectedId?: string; onSelect: (ticket: Ticket) => void }) {
  if (tickets.length === 0) {
    return (
      <div className="empty-state">
        <FileSearch size={28} />
        <h3>Nenhum chamado encontrado</h3>
        <p>A fila mostra chamados permitidos pelo seu perfil. Ajuste os filtros ou abra o primeiro chamado.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap ticket-table-wrap">
      <table className="ticket-table">
        <thead>
          <tr>
            <th>Chamado</th>
            <th>Tipo</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>SLA</th>
            <th>Grupo</th>
            <th>Tecnico</th>
            <th>Solicitante</th>
            <th>Servico</th>
            <th>IA</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const openTicket = () => onSelect(ticket);
            const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openTicket();
              }
            };

            return (
              <tr
                key={ticket.id}
                className={ticket.id === selectedId ? "ticket-table-row selected-row" : "ticket-table-row"}
                role="button"
                tabIndex={0}
                aria-label={`Abrir chamado ${ticket.number}: ${ticket.title}`}
                onClick={openTicket}
                onKeyDown={handleKeyDown}
              >
                <td data-label="Chamado">
                  <span className="row-link">
                    {ticket.number}
                  </span>
                  <small className="ticket-title">{ticket.title}</small>
                </td>
                <td data-label="Tipo">{typeLabel(ticket.type)}</td>
                <td data-label="Prioridade"><Badge tone={priorityTone(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge></td>
                <td data-label="Status"><Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge></td>
                <td data-label="SLA"><SlaBadge ticket={ticket} /></td>
                <td data-label="Grupo">{ticket.assignedGroupName ?? "Sem grupo"}</td>
                <td data-label="Tecnico">{ticket.assigneeName ?? "Nao atribuido"}</td>
                <td data-label="Solicitante">{ticket.requesterEmail}</td>
                <td data-label="Servico">{ticket.affectedService}</td>
                <td data-label="IA">{Math.round((ticket.ai.triage?.confidence ?? 0) * 100)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
