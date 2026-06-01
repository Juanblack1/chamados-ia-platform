import type { ReactNode } from "react";
import type { Ticket } from "../lib/api";
import { relativeDue, slaRisk } from "../lib/presentation";

export function AdminPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="panel admin-panel">
      <div className="panel-heading">
        <div className="heading-inline">
          {icon}
          <h2>{title}</h2>
        </div>
      </div>
      <div className="admin-list">{children}</div>
    </section>
  );
}

export function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function AnalysisItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="analysis-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function SlaBadge({ ticket }: { ticket: Ticket }) {
  const risk = slaRisk(ticket);
  const due = new Date(ticket.sla.resolutionDueAt);
  return (
    <Badge tone={risk === "breached" ? "danger" : risk === "warning" ? "warning" : "success"}>
      {risk === "breached" ? "SLA vencido" : `${ticket.sla.label} - ${relativeDue(due)}`}
    </Badge>
  );
}

export function SkeletonRows() {
  return (
    <div className="skeleton-rows" aria-label="Carregando chamados">
      {Array.from({ length: 7 }).map((_, index) => <span key={index} />)}
    </div>
  );
}
