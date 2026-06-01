import { useMemo, type KeyboardEvent } from "react";
import { Activity, AlertTriangle, Bot, Clock3, FileSearch, TicketCheck } from "lucide-react";
import type { Ticket } from "../../lib/api";
import { priorityLabel, priorityTone, slaRisk, statusLabel, statusTone, typeLabel } from "../../lib/presentation";
import { Badge, SkeletonRows, SlaBadge } from "../../components/common";

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

  return (
    <section className="queue-layout" aria-label="Fila operacional">
      <MetricStrip metrics={metrics} />
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
