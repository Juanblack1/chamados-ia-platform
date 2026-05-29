import { randomUUID } from "node:crypto";
import type { CreateTicketInput, Ticket } from "./ticket.js";

export class TicketRepository {
  private readonly tickets = new Map<string, Ticket>();
  private sequence = 4021;

  constructor() {
    this.seed();
  }

  list(): Ticket[] {
    return [...this.tickets.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findById(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }

  create(input: CreateTicketInput): Ticket {
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: randomUUID(),
      number: `INC-${++this.sequence}`,
      ...input,
      category: "Unclassified",
      priority: input.urgency,
      status: "triaging",
      tags: [],
      createdAt: now,
      updatedAt: now,
      ai: {
        retrievedSources: []
      },
      timeline: [
        {
          id: randomUUID(),
          actor: "requester",
          message: input.description,
          createdAt: now
        }
      ]
    };

    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  update(id: string, patch: Partial<Ticket>): Ticket | undefined {
    const current = this.tickets.get(id);
    if (!current) return undefined;

    const next: Ticket = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.tickets.set(id, next);
    return next;
  }

  private seed(): void {
    const now = new Date().toISOString();
    const samples: Ticket[] = [
      {
        id: randomUUID(),
        number: "INC-4019",
        requesterEmail: "maria.silva@acme.local",
        department: "Financeiro",
        title: "Falha no fechamento de faturamento",
        description: "O modulo de faturamento retorna erro ao processar notas do lote mensal.",
        affectedService: "ERP Central",
        businessImpact: "Fechamento fiscal bloqueado para a unidade SP.",
        attachments: [],
        category: "ERP",
        priority: "critical",
        status: "escalated",
        tags: ["erp", "billing", "sla-risk"],
        createdAt: now,
        updatedAt: now,
        ai: { retrievedSources: [] },
        timeline: []
      },
      {
        id: randomUUID(),
        number: "INC-4020",
        requesterEmail: "joao.costa@acme.local",
        department: "Operacoes",
        title: "VPN desconecta a cada dez minutos",
        description: "Equipe remota perde conexao VPN durante atendimento aos clientes.",
        affectedService: "Rede Corporativa",
        businessImpact: "Atendimento externo instavel.",
        attachments: [],
        category: "Network",
        priority: "high",
        status: "open",
        tags: ["vpn", "network"],
        createdAt: now,
        updatedAt: now,
        ai: { retrievedSources: [] },
        timeline: []
      }
    ];

    samples.forEach((ticket) => this.tickets.set(ticket.id, ticket));
  }
}
