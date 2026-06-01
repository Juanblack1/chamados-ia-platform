import type { RagSource, Ticket, TicketAgentMemoryEntry } from "../../domain/ticket.js";
import type { AppUser } from "../../security/authStore.js";
import type { ModelGateway, ModelStreamEvent } from "../modelGateway.js";
import type { TicketDatabaseResult } from "../mastra/ticketDatabaseTool.js";
import { createTicketSpecialistMastraAgent } from "../mastra/ticketAgent.js";

export type TicketSpecialistChatContext = {
  activeTicket: Ticket;
  accessibleTickets: Ticket[];
  actor: AppUser;
  message: string;
  memory: TicketAgentMemoryEntry[];
  databaseContext?: TicketDatabaseResult;
  sources: RagSource[];
};

export class TicketSpecialistChatAgent {
  readonly mastraAgent: unknown;

  constructor(
    private readonly llm: ModelGateway,
    databaseTool?: unknown
  ) {
    this.mastraAgent = createTicketSpecialistMastraAgent(databaseTool ? { queryServiceDeskDatabase: databaseTool } : undefined);
  }

  async run(context: TicketSpecialistChatContext): Promise<string> {
    return this.llm.completeText({
      ...buildPrompt(context),
      fallback: () => fallbackAnswer(context)
    });
  }

  stream(context: TicketSpecialistChatContext): AsyncGenerator<ModelStreamEvent> {
    return this.llm.streamText({
      ...buildPrompt(context),
      fallback: () => fallbackAnswer(context)
    });
  }
}

function buildPrompt(context: TicketSpecialistChatContext): { system: string; user: string } {
  return {
    system: [
      "Voce e o agente Mastra ticket-specialist, especialista senior em service desk corporativo.",
      "Responda em portugues do Brasil, com orientacao objetiva, passos acionaveis e cuidado com SLA.",
      "Nunca responda em ingles.",
      "Use apenas chamados autorizados, memoria do agente, historico do chamado, contexto da ferramenta read-only de banco, evidencias RAG e politicas informadas.",
      "Nao invente dados externos. Quando faltar informacao, diga exatamente o que coletar."
    ].join(" "),
    user: JSON.stringify(
      {
        agent: {
          id: "ticket-specialist",
          name: "Ticket Specialist Agent"
        },
        actor: {
          id: context.actor.id,
          role: context.actor.role,
          email: context.actor.email
        },
        activeTicket: summarizeTicket(context.activeTicket, true),
        allAuthorizedTicketsContext: context.accessibleTickets.map((ticket) => summarizeTicket(ticket, false)),
        recentAgentMemory: context.memory.slice(-12).map((item) => ({
          agent: item.agent,
          role: item.role,
          actorName: item.actorName,
          content: item.content,
          createdAt: item.createdAt
        })),
        serviceDeskDatabaseToolContext: context.databaseContext,
        ragSources: context.sources,
        userMessage: context.message
      },
      null,
      2
    )
  };
}

function summarizeTicket(ticket: Ticket, includeDetails: boolean) {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    requesterEmail: ticket.requesterEmail,
    department: ticket.department,
    affectedService: ticket.affectedService,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    assignedGroupName: ticket.assignedGroupName,
    assigneeName: ticket.assigneeName,
    sla: ticket.sla,
    tags: ticket.tags,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    ...(includeDetails
      ? {
          description: ticket.description,
          businessImpact: ticket.businessImpact,
          triage: ticket.ai.triage,
          resolutionDraft: ticket.ai.resolutionDraft,
          followups: ticket.followups.slice(-8),
          tasks: ticket.tasks,
          audit: ticket.audit.slice(-8)
        }
      : {})
  };
}

function fallbackAnswer(context: TicketSpecialistChatContext): string {
  const ticket = context.activeTicket;
  const openTasks = ticket.tasks.filter((task) => task.status !== "done").map((task) => task.title);
  const nextStep = openTasks[0] ?? "registrar um acompanhamento claro com impacto, horario e evidencias coletadas";
  const source = context.sources[0]?.title ?? "a base de conhecimento disponivel";

  return [
    `Analisei o chamado ${ticket.number} e o contexto autorizado da fila.`,
    `Status atual: ${statusLabel(ticket.status)}. Prioridade: ${priorityLabel(ticket.priority)}. Grupo: ${ticket.assignedGroupName ?? "sem grupo"}.`,
    context.databaseContext?.memories.length
      ? `Memoria consultada: ${context.databaseContext.memories.length} registro(s) de chamados relacionados.`
      : "Memoria consultada: nenhum aprendizado relacionado encontrado.",
    `Proximo passo recomendado: ${nextStep}.`,
    `Use ${source} como referencia e mantenha o solicitante informado antes de alterar a solucao final.`
  ].join("\n");
}

function priorityLabel(priority: string): string {
  if (priority === "critical") return "critica";
  if (priority === "high") return "alta";
  if (priority === "medium") return "media";
  return "baixa";
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: "Novo",
    open: "Aberto",
    triaging: "Em triagem",
    in_progress: "Em atendimento",
    waiting_customer: "Aguardando solicitante",
    pending_approval: "Aguardando aprovacao",
    escalated: "Escalado",
    resolved: "Resolvido",
    closed: "Fechado"
  };
  return labels[status] ?? status;
}
