import type { AppUser, CreateTicketPayload, IntakeAssessment, PermissionKey, Ticket, TicketPriority } from "./api";

export type View = "queue" | "new" | "detail" | "users" | "profile";

export const MAX_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export const initialForm: CreateTicketPayload = {
  type: "incident",
  requesterEmail: "",
  department: "Operacoes",
  title: "",
  description: "",
  affectedService: "ERP Central",
  urgency: "medium",
  impact: "medium",
  businessImpact: "",
  attachments: []
};

export function estimatedPriority(form: CreateTicketPayload): TicketPriority {
  const score = priorityScore(form.urgency) + priorityScore(form.impact);
  if (score >= 7) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function estimatedGroup(form: CreateTicketPayload) {
  const text = `${form.affectedService} ${form.title} ${form.description}`.toLowerCase();
  if (/vpn|rede|wi-fi|conexao/.test(text)) return "N2 Redes e Conectividade";
  if (/mfa|senha|login|acesso|sso/.test(text)) return "N1 Identidade e Acesso";
  if (/erp|faturamento|fiscal|nota/.test(text)) return "N2 ERP e Financeiro";
  if (/hardware|notebook|computador|impressora|monitor|patrimonio|serial/.test(text)) return "N1 Hardware e Workplace";
  if (/aprovacao|aprovar|compras|orcamento|centro de custo|acesso privilegiado/.test(text)) return "Gestao de Aprovacoes";
  return "N3 Plataforma e Integracoes";
}

export function priorityScore(priority: TicketPriority) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

export function slaRisk(ticket: Ticket): "ok" | "warning" | "breached" {
  if (ticket.status === "resolved" || ticket.status === "closed") return "ok";
  const due = Date.parse(ticket.sla.resolutionDueAt);
  const remaining = due - Date.now();
  if (remaining <= 0 || ticket.sla.breached) return "breached";
  if (remaining <= 60 * 60 * 1000) return "warning";
  return "ok";
}

export function relativeDue(due: Date) {
  const minutes = Math.round((due.getTime() - Date.now()) / 60_000);
  if (minutes < 0) return "vencido";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

export function hasPermission(user: AppUser, permission: PermissionKey): boolean {
  return (user.permissions ?? defaultPermissionsForRole(user.role)).includes(permission);
}

export function canManageUsers(user: AppUser): boolean {
  return hasPermission(user, "users.manage");
}

export function canOpenTicketForOthers(user: AppUser): boolean {
  return hasPermission(user, "tickets.work") || hasPermission(user, "users.manage");
}

export function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "manager" || role === "supervisor") return "Gestor";
  if (role === "employee" || role === "technician") return "Funcionario";
  return "Solicitante";
}

export function typeLabel(type: string) {
  return type === "request" ? "Solicitacao" : "Incidente";
}

export function priorityLabel(priority: string) {
  if (priority === "critical") return "Critica";
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  return "Baixa";
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Novo",
    open: "Aberto",
    triaging: "Triagem",
    in_progress: "Em atendimento",
    waiting_customer: "Aguardando solicitante",
    pending_approval: "Aguardando aprovacao",
    escalated: "Escalado",
    resolved: "Resolvido",
    closed: "Fechado"
  };
  return labels[status] ?? status;
}

export function priorityTone(priority: string) {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

export function statusTone(status: string) {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "escalated") return "danger";
  if (status === "waiting_customer" || status === "pending_approval") return "warning";
  if (status === "triaging" || status === "in_progress") return "info";
  return "neutral";
}

export function readinessLabel(readiness: string) {
  if (readiness === "ready") return "Pronto";
  if (readiness === "self_service") return "Autoatendimento";
  return "Pedir dados";
}

export function assessmentTone(assessment: IntakeAssessment) {
  if (assessment.readiness === "ready") return "success";
  if (assessment.readiness === "self_service") return "info";
  return "warning";
}

export function roleOptions(): Array<{ value: AppUser["role"]; label: string }> {
  return [
    { value: "employee", label: "Funcionario" },
    { value: "manager", label: "Gestor" },
    { value: "requester", label: "Solicitante" },
    { value: "admin", label: "Administrador" }
  ];
}

export function permissionOptions(): Array<{ value: PermissionKey; label: string; description: string }> {
  return [
    { value: "tickets.open", label: "Abrir chamados", description: "Pode registrar novos chamados no portal." },
    { value: "tickets.read", label: "Ler chamados", description: "Pode acessar chamados dentro do escopo do cargo e grupos." },
    { value: "tickets.work", label: "Tratar chamados", description: "Pode atribuir, mudar status, criar tarefas e resolver." },
    { value: "tickets.delete", label: "Excluir chamados", description: "Pode remover chamados da base operacional." },
    { value: "users.manage", label: "Gerenciar usuarios", description: "Pode criar usuarios e alterar cargos, grupos e permissoes." }
  ];
}

export function defaultPermissionsForRole(role: AppUser["role"]): PermissionKey[] {
  if (role === "admin") return permissionOptions().map((permission) => permission.value);
  if (role === "manager" || role === "employee") return ["tickets.open", "tickets.read", "tickets.work"];
  return ["tickets.open", "tickets.read"];
}
