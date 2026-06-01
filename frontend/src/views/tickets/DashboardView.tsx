import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Clock3,
  Gauge,
  ListFilter,
  TicketCheck
} from "lucide-react";
import type { Ticket, TicketPriority, TicketStatus } from "../../lib/api";
import { priorityLabel, priorityTone, slaRisk, statusLabel, statusTone } from "../../lib/presentation";
import { Badge, SkeletonRows, SlaBadge } from "../../components/common";

const statusOrder: TicketStatus[] = [
  "new",
  "open",
  "triaging",
  "in_progress",
  "waiting_customer",
  "pending_approval",
  "escalated",
  "resolved",
  "closed"
];

const priorityOrder: TicketPriority[] = ["critical", "high", "medium", "low"];

export function DashboardView({
  tickets,
  isLoading,
  onStatusSelect,
  onOpenQueue,
  onOpenTicket
}: {
  tickets: Ticket[];
  isLoading: boolean;
  onStatusSelect: (status: TicketStatus) => void;
  onOpenQueue: () => void;
  onOpenTicket: (ticket: Ticket) => void;
}) {
  const model = useMemo(() => buildDashboardModel(tickets), [tickets]);

  if (isLoading) {
    return (
      <section className="dashboard-layout" aria-label="Dashboard operacional">
        <SkeletonRows />
      </section>
    );
  }

  return (
    <section className="dashboard-layout" aria-label="Dashboard operacional">
      <div className="dashboard-status-grid" aria-label="Chamados por status">
        {model.statusCards.map((card) => (
          <button
            type="button"
            className={`status-card ${card.status}${card.hasCriticalRisk ? " critical-risk" : ""}`}
            key={card.status}
            onClick={() => onStatusSelect(card.status)}
            aria-label={`Filtrar chamados com status ${card.label}: ${card.count}${card.hasCriticalRisk ? ", acao imediata" : ""}`}
          >
            {card.hasCriticalRisk ? (
              <span className="risk-strip">
                <AlertTriangle size={15} />
                Acao imediata
              </span>
            ) : null}
            <div className="status-card-top">
              <span>{card.label}</span>
              <Badge tone={statusTone(card.status)}>{card.label}</Badge>
            </div>
            <strong>{card.count}</strong>
            <small>{card.hint}</small>
            <span className="status-card-action">
              <ListFilter size={15} />
              Filtrar lista
            </span>
          </button>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel situation-panel" aria-labelledby="situation-title">
          <div className="panel-heading">
            <div className="heading-inline">
              <BarChart3 size={20} />
              <div>
                <h2 id="situation-title">Situacao geral</h2>
                <p>Status, risco e carga ativa da fila autorizada.</p>
              </div>
            </div>
            <Badge tone={model.activeTickets > 0 ? "info" : "success"}>{model.activeRatio}% ativos</Badge>
          </div>

          <div className="overview-chart" aria-label="Distribuicao de status">
            <div className="overview-summary">
              <span>Total</span>
              <strong>{model.totalTickets}</strong>
              <small>{model.activeTickets} ativos, {model.closedTickets} encerrados</small>
            </div>
            <div className="status-distribution">
              {model.statusCards.map((card) => (
                <div className="distribution-row" key={card.status}>
                  <div>
                    <span>{card.label}</span>
                    <strong>{card.count}</strong>
                  </div>
                  <div className="distribution-track" aria-hidden="true">
                    <span className={`distribution-fill ${statusTone(card.status)}`} style={{ width: `${card.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="priority-risk-grid" aria-label="Chamados por prioridade">
            {model.priorityBars.map((item) => (
              <div className="priority-risk-item" key={item.priority}>
                <div>
                  <Badge tone={priorityTone(item.priority)}>{priorityLabel(item.priority)}</Badge>
                  <strong>{item.count}</strong>
                </div>
                <div className="distribution-track" aria-hidden="true">
                  <span className={`distribution-fill ${priorityTone(item.priority)}`} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="dashboard-insights" aria-label="Insights operacionais">
          <section className="panel compact-panel">
            <div className="insight-row">
              <Clock3 size={18} />
              <div>
                <span>SLA em atencao</span>
                <strong>{model.slaAttention.length}</strong>
              </div>
            </div>
            {model.slaAttention.length ? (
              <div className="insight-list">
                {model.slaAttention.map((ticket) => (
                  <button type="button" key={ticket.id} onClick={() => onOpenTicket(ticket)}>
                    <span>{ticket.number}</span>
                    <strong>{ticket.title}</strong>
                    <SlaBadge ticket={ticket} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="insight-empty">Nenhum chamado com SLA vencido ou perto do vencimento.</p>
            )}
          </section>

          <section className="panel compact-panel">
            <div className="insight-row">
              <Bot size={18} />
              <div>
                <span>Confianca IA</span>
                <strong>{model.aiConfidence}%</strong>
              </div>
            </div>
            <div className="confidence-meter" aria-label={`Confianca IA ${model.aiConfidence}%`}>
              <span style={{ width: `${model.aiConfidence}%` }} />
            </div>
            <p className="insight-empty">Media calculada pelos chamados com triagem registrada.</p>
          </section>

          <section className="panel compact-panel prediction-panel">
            <div className="insight-row">
              <BarChart3 size={18} />
              <div>
                <span>Predicao de volume</span>
                <strong>{model.volumePrediction.next24h}</strong>
              </div>
            </div>
            <div className="volume-bars" aria-label="Predicao de volume de chamados">
              {model.volumePrediction.bars.map((bar) => (
                <div className="volume-bar-row" key={bar.label}>
                  <div>
                    <span>{bar.label}</span>
                    <strong>{bar.value}</strong>
                  </div>
                  <div className="distribution-track" aria-hidden="true">
                    <span style={{ width: `${bar.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="insight-empty">{model.volumePrediction.forecast}</p>
          </section>

          <section className="panel compact-panel">
            <div className="insight-row">
              <AlertTriangle size={18} />
              <div>
                <span>Criticos abertos</span>
                <strong>{model.criticalOpen.length}</strong>
              </div>
            </div>
            <div className="insight-list">
              {model.criticalOpen.length ? (
                model.criticalOpen.map((ticket) => (
                  <button type="button" key={ticket.id} onClick={() => onOpenTicket(ticket)}>
                    <span>{ticket.number}</span>
                    <strong>{ticket.title}</strong>
                    <small>{ticket.assignedGroupName ?? "Sem grupo"}</small>
                  </button>
                ))
              ) : (
                <p className="insight-empty">Sem P1 ativo na fila.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="panel latest-tickets-panel" aria-labelledby="latest-title">
        <div className="panel-heading">
          <div className="heading-inline">
            <TicketCheck size={20} />
            <div>
              <h2 id="latest-title">Ultimos chamados</h2>
              <p>Amostra recente da fila autorizada.</p>
            </div>
          </div>
          <button type="button" className="secondary-button" onClick={onOpenQueue}>
            <span>Ver lista</span>
            <ArrowRight size={16} />
          </button>
        </div>
        {model.latestTickets.length ? (
          <div className="latest-ticket-list">
            {model.latestTickets.map((ticket) => (
              <button type="button" className="latest-ticket-row" key={ticket.id} onClick={() => onOpenTicket(ticket)}>
                <div>
                  <span className="row-link">{ticket.number}</span>
                  <strong>{ticket.title}</strong>
                  <small>{ticket.requesterEmail}</small>
                </div>
                <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                <Badge tone={priorityTone(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>
                <span>{ticket.assignedGroupName ?? "Sem grupo"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Gauge size={28} />
            <h3>Nenhum chamado no dashboard</h3>
            <p>Quando houver chamados autorizados, os indicadores aparecem aqui.</p>
          </div>
        )}
      </section>
    </section>
  );
}

function buildDashboardModel(tickets: Ticket[]) {
  const totalTickets = tickets.length;
  const activeTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
  const closedTickets = totalTickets - activeTickets;
  const maxStatusCount = Math.max(1, ...statusOrder.map((status) => tickets.filter((ticket) => ticket.status === status).length));
  const maxPriorityCount = Math.max(1, ...priorityOrder.map((priority) => tickets.filter((ticket) => ticket.priority === priority).length));
  const confidenceItems = tickets.map((ticket) => ticket.ai.triage?.confidence ?? 0).filter(Boolean);
  const volumePrediction = predictTicketVolume(tickets, activeTickets);

  return {
    totalTickets,
    activeTickets,
    closedTickets,
    activeRatio: totalTickets ? Math.round((activeTickets / totalTickets) * 100) : 0,
    aiConfidence: confidenceItems.length
      ? Math.round((confidenceItems.reduce((sum, value) => sum + value, 0) / confidenceItems.length) * 100)
      : 0,
    statusCards: statusOrder.map((status) => {
      const statusTickets = tickets.filter((ticket) => ticket.status === status);
      return {
        status,
        label: statusLabel(status),
        count: statusTickets.length,
        percent: Math.max(4, Math.round((statusTickets.length / maxStatusCount) * 100)),
        hint: statusHint(status, statusTickets),
        hasCriticalRisk:
          statusTickets.some((ticket) => ticket.priority === "critical" || slaRisk(ticket) === "breached") || status === "escalated"
      };
    }),
    priorityBars: priorityOrder.map((priority) => {
      const count = tickets.filter((ticket) => ticket.priority === priority).length;
      return {
        priority,
        count,
        percent: Math.max(4, Math.round((count / maxPriorityCount) * 100))
      };
    }),
    slaAttention: tickets
      .filter((ticket) => slaRisk(ticket) !== "ok")
      .sort((left, right) => Date.parse(left.sla.resolutionDueAt) - Date.parse(right.sla.resolutionDueAt))
      .slice(0, 3),
    criticalOpen: tickets
      .filter((ticket) => ticket.priority === "critical" && !["resolved", "closed"].includes(ticket.status))
      .slice(0, 3),
    volumePrediction,
    latestTickets: [...tickets]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 6)
  };
}

function predictTicketVolume(tickets: Ticket[], activeTickets: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const createdLast24h = tickets.filter((ticket) => Date.parse(ticket.createdAt) >= now - dayMs).length;
  const createdLast7d = tickets.filter((ticket) => Date.parse(ticket.createdAt) >= now - 7 * dayMs).length;
  const highRiskActive = tickets.filter(
    (ticket) => !["resolved", "closed"].includes(ticket.status) && ["critical", "high"].includes(ticket.priority)
  ).length;
  const today = Math.max(createdLast24h, Math.ceil(activeTickets * 0.25));
  const next24h = Math.max(today, Math.ceil(today * 1.15 + highRiskActive * 0.35));
  const sevenDays = Math.max(next24h, Math.ceil((createdLast7d || today * 3) * 1.2 + highRiskActive));
  const max = Math.max(1, today, next24h, sevenDays);
  const trend = today > 0 ? Math.max(0, Math.round(((next24h - today) / today) * 100)) : 0;

  return {
    today,
    next24h,
    sevenDays,
    forecast:
      trend > 0
        ? `Aumento de ${trend}% previsto nas proximas 24h pela fila ativa e risco atual.`
        : "Volume previsto estavel para as proximas 24h.",
    bars: [
      { label: "Hoje", value: today, percent: Math.max(4, Math.round((today / max) * 100)) },
      { label: "Prox. 24h", value: next24h, percent: Math.max(4, Math.round((next24h / max) * 100)) },
      { label: "7 dias", value: sevenDays, percent: Math.max(4, Math.round((sevenDays / max) * 100)) }
    ]
  };
}

function statusHint(status: TicketStatus, tickets: Ticket[]): string {
  const critical = tickets.filter((ticket) => ticket.priority === "critical").length;
  const breached = tickets.filter((ticket) => slaRisk(ticket) === "breached").length;
  if (breached) return `${breached} com SLA vencido`;
  if (critical) return `${critical} critico(s)`;
  if (status === "waiting_customer") return "Dependem do solicitante";
  if (status === "pending_approval") return "Aguardam aprovacao";
  if (status === "resolved" || status === "closed") return "Encerrados no periodo";
  return tickets.length ? "Fila operacional" : "Sem chamados";
}
