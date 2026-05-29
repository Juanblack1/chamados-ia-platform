import type { CreateTicketInput, TicketPriority, TicketSla } from "./ticket.js";

export type ServiceDeskGroup = {
  id: string;
  name: string;
  services: string[];
};

export type SlaPolicy = {
  id: string;
  name: string;
  priority: TicketPriority;
  responseMinutes: number;
  resolutionMinutes: number;
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  source: string;
  category: string;
  updatedAt: string;
};

export const serviceDeskGroups: ServiceDeskGroup[] = [
  { id: "grp-erp", name: "N2 ERP e Financeiro", services: ["ERP Central", "Portal Financeiro"] },
  { id: "grp-network", name: "N2 Redes e Conectividade", services: ["Rede Corporativa", "VPN", "Wi-Fi Corporativo"] },
  { id: "grp-iam", name: "N1 Identidade e Acesso", services: ["Identity Access", "SSO", "MFA"] },
  { id: "grp-platform", name: "N3 Plataforma e Integracoes", services: ["Portal Cliente", "APIs Corporativas"] }
];

export const slaPolicies: SlaPolicy[] = [
  { id: "sla-p1", name: "P1 Critico", priority: "critical", responseMinutes: 15, resolutionMinutes: 240 },
  { id: "sla-p2", name: "P2 Alto", priority: "high", responseMinutes: 60, resolutionMinutes: 480 },
  { id: "sla-p3", name: "P3 Medio", priority: "medium", responseMinutes: 240, resolutionMinutes: 1440 },
  { id: "sla-p4", name: "P4 Baixo", priority: "low", responseMinutes: 480, resolutionMinutes: 2880 }
];

export const knowledgeArticles: KnowledgeArticle[] = [
  { id: "kb-erp-001", title: "Runbook de falha no lote fiscal ERP", source: "kb://erp/billing-batch", category: "ERP", updatedAt: "2026-05-20" },
  { id: "kb-net-001", title: "Diagnostico de instabilidade VPN", source: "kb://network/vpn-disconnect", category: "Network", updatedAt: "2026-05-22" },
  { id: "kb-iam-001", title: "Reset seguro de MFA e SSO", source: "kb://iam/mfa-reset", category: "Identity Access", updatedAt: "2026-05-18" }
];

export function calculatePriority(urgency: TicketPriority, impact: TicketPriority): TicketPriority {
  const score = priorityScore(urgency) + priorityScore(impact);
  if (score >= 7) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function selectGroup(input: Pick<CreateTicketInput, "affectedService" | "title" | "description">): ServiceDeskGroup {
  const text = `${input.affectedService} ${input.title} ${input.description}`.toLowerCase();
  return (
    serviceDeskGroups.find((group) => group.services.some((service) => text.includes(service.toLowerCase()))) ??
    serviceDeskGroups.find((group) => /senha|mfa|login|acesso|sso/.test(text) && group.id === "grp-iam") ??
    serviceDeskGroups.find((group) => /vpn|rede|latencia|conexao|wi-fi/.test(text) && group.id === "grp-network") ??
    serviceDeskGroups.find((group) => /erp|faturamento|nota|fiscal/.test(text) && group.id === "grp-erp") ??
    serviceDeskGroups[3]
  );
}

export function buildSla(priority: TicketPriority, createdAt: string): TicketSla {
  const policy = slaPolicies.find((item) => item.priority === priority) ?? slaPolicies[2];
  const created = new Date(createdAt).getTime();
  return {
    policyId: policy.id,
    label: policy.name,
    responseDueAt: new Date(created + policy.responseMinutes * 60_000).toISOString(),
    resolutionDueAt: new Date(created + policy.resolutionMinutes * 60_000).toISOString(),
    breached: false,
    paused: false
  };
}

function priorityScore(priority: TicketPriority): number {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}
