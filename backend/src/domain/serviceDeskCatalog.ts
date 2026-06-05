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
  ownerGroupId: string;
  reviewCadenceDays: number;
  status: "active" | "needs_review";
};

export type OpeningTemplate = {
  id: string;
  category: string;
  affectedService: string;
  type: "incident" | "request";
  assignedGroupId: string;
  titlePlaceholder: string;
  descriptionPrompt: string;
  businessImpactPrompt: string;
  requiredFields: string[];
  examples: string[];
};

export const serviceDeskGroups: ServiceDeskGroup[] = [
  { id: "grp-erp", name: "N2 ERP e Financeiro", services: ["ERP Central", "Portal Financeiro"] },
  { id: "grp-network", name: "N2 Redes e Conectividade", services: ["Rede Corporativa", "VPN", "Wi-Fi Corporativo"] },
  { id: "grp-iam", name: "N1 Identidade e Acesso", services: ["Identity Access", "SSO", "MFA"] },
  { id: "grp-platform", name: "N3 Plataforma e Integracoes", services: ["Portal Cliente", "APIs Corporativas"] },
  { id: "grp-workplace", name: "N1 Hardware e Workplace", services: ["Hardware", "Notebook", "Impressoras"] },
  { id: "grp-approvals", name: "Gestao de Aprovacoes", services: ["Aprovacoes", "Compras", "Acessos privilegiados"] }
];

export const slaPolicies: SlaPolicy[] = [
  { id: "sla-p1", name: "P1 Critico", priority: "critical", responseMinutes: 15, resolutionMinutes: 240 },
  { id: "sla-p2", name: "P2 Alto", priority: "high", responseMinutes: 60, resolutionMinutes: 480 },
  { id: "sla-p3", name: "P3 Medio", priority: "medium", responseMinutes: 240, resolutionMinutes: 1440 },
  { id: "sla-p4", name: "P4 Baixo", priority: "low", responseMinutes: 480, resolutionMinutes: 2880 }
];

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    id: "kb-erp-billing-lock",
    title: "ERP billing batch failure runbook",
    source: "Confluence / ERP / Billing",
    category: "ERP",
    updatedAt: "2026-05-20",
    ownerGroupId: "grp-erp",
    reviewCadenceDays: 30,
    status: "active"
  },
  {
    id: "kb-vpn-instability",
    title: "VPN instability and packet loss checklist",
    source: "Network runbook",
    category: "Network",
    updatedAt: "2026-05-22",
    ownerGroupId: "grp-network",
    reviewCadenceDays: 30,
    status: "active"
  },
  {
    id: "kb-access-reset",
    title: "Identity access reset policy",
    source: "IAM policy",
    category: "Identity Access",
    updatedAt: "2026-05-18",
    ownerGroupId: "grp-iam",
    reviewCadenceDays: 60,
    status: "active"
  },
  {
    id: "kb-priority-sla",
    title: "Priority and SLA classification",
    source: "Service desk policy",
    category: "SLA",
    updatedAt: "2026-04-01",
    ownerGroupId: "grp-approvals",
    reviewCadenceDays: 30,
    status: "needs_review"
  }
];

export const openingTemplates: OpeningTemplate[] = [
  {
    id: "tpl-erp",
    category: "ERP",
    affectedService: "ERP Central",
    type: "incident",
    assignedGroupId: "grp-erp",
    titlePlaceholder: "Erro no fechamento fiscal do ERP",
    descriptionPrompt: "Informe modulo, transacao, mensagem de erro, horario de inicio, lote/documento afetado e filial.",
    businessImpactPrompt: "Descreva fechamento bloqueado, notas paradas, valor/filial afetada ou prazo fiscal em risco.",
    requiredFields: ["modulo/transacao", "mensagem de erro", "horario de inicio", "filial ou lote afetado", "impacto fiscal/financeiro"],
    examples: ["Lote 0429 falha com erro FIS-103 desde 09:00 na filial SP.", "Emissao de NF-e bloqueada para todos os analistas do faturamento."]
  },
  {
    id: "tpl-identity",
    category: "Identidade e acesso",
    affectedService: "Identity Access",
    type: "request",
    assignedGroupId: "grp-iam",
    titlePlaceholder: "Falha de MFA no login corporativo",
    descriptionPrompt: "Informe usuario afetado, aplicacao, metodo de autenticacao, erro exibido e se houve troca de aparelho/senha.",
    businessImpactPrompt: "Explique qual atividade esta parada e se existe aprovacao do gestor para alteracao de acesso.",
    requiredFields: ["usuario afetado", "aplicacao", "tipo de acesso", "erro ou solicitacao", "aprovador quando aplicavel"],
    examples: ["Usuario ana@empresa.com nao recebe push MFA para acessar o ERP.", "Solicito acesso ao grupo financeiro aprovado por Carla Menezes."]
  },
  {
    id: "tpl-network",
    category: "Rede",
    affectedService: "Rede Corporativa",
    type: "incident",
    assignedGroupId: "grp-network",
    titlePlaceholder: "VPN instavel para equipe externa",
    descriptionPrompt: "Informe localidade, rede/VPN usada, horario, frequencia, usuarios afetados, erro e testes ja realizados.",
    businessImpactPrompt: "Descreva atendimento, operacao ou unidade afetada e quantidade aproximada de usuarios.",
    requiredFields: ["localidade", "usuarios afetados", "horario/frequencia", "servico de rede", "testes realizados"],
    examples: ["VPN cai a cada 10 minutos para 12 vendedores externos desde 08:30.", "Wi-Fi corporativo sem DHCP no 3o andar."]
  },
  {
    id: "tpl-apis",
    category: "APIs e integracoes",
    affectedService: "APIs Corporativas",
    type: "incident",
    assignedGroupId: "grp-platform",
    titlePlaceholder: "API de pedidos retornando 500",
    descriptionPrompt: "Informe endpoint, ambiente, horario, payload/correlation id, status HTTP, consumidor afetado e volume.",
    businessImpactPrompt: "Explique processo integrado impactado, volume represado e clientes/sistemas consumidores.",
    requiredFields: ["endpoint", "ambiente", "status/correlation id", "consumidor", "volume ou janela de erro"],
    examples: ["POST /orders retorna 500 no prod com correlation id abc-123 desde 13:15.", "Webhook de faturamento atrasado para o parceiro X."]
  },
  {
    id: "tpl-hardware",
    category: "Hardware",
    affectedService: "Hardware",
    type: "request",
    assignedGroupId: "grp-workplace",
    titlePlaceholder: "Notebook nao liga apos atualizacao",
    descriptionPrompt: "Informe equipamento, patrimonio/serial, usuario, localidade, sintomas, urgencia e evidencias visuais.",
    businessImpactPrompt: "Descreva atividade bloqueada, prazo e se ha equipamento reserva disponivel.",
    requiredFields: ["patrimonio/serial", "usuario", "localidade", "sintoma", "necessidade de reserva"],
    examples: ["Notebook PAT-2044 nao liga para analista do fiscal em SP.", "Impressora do estoque falha ao imprimir etiquetas."]
  },
  {
    id: "tpl-approvals",
    category: "Aprovacoes",
    affectedService: "Aprovacoes",
    type: "request",
    assignedGroupId: "grp-approvals",
    titlePlaceholder: "Aprovacao de acesso ao painel financeiro",
    descriptionPrompt: "Informe item solicitado, justificativa, aprovador, prazo, centro de custo e evidencias/anexos.",
    businessImpactPrompt: "Explique por que a aprovacao e necessaria, prazo de negocio e risco se nao for atendida.",
    requiredFields: ["item solicitado", "justificativa", "aprovador", "prazo", "centro de custo ou area"],
    examples: ["Aprovacao para acesso temporario ao painel DRE ate 30/06.", "Compra de monitor para posto novo aprovada pelo gestor."]
  }
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
    serviceDeskGroups.find((group) => /hardware|notebook|computador|impressora|monitor|patrimonio|serial/.test(text) && group.id === "grp-workplace") ??
    serviceDeskGroups.find((group) => /aprovacao|aprovar|compras|orcamento|centro de custo|acesso privilegiado/.test(text) && group.id === "grp-approvals") ??
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
