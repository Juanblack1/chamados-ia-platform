import { randomUUID } from "node:crypto";
import type { CreateTicketInput, Ticket } from "./ticket.js";
import { buildSla, calculatePriority, selectGroup } from "./serviceDeskCatalog.js";

export type TicketStoreKind = "memory" | "redis";

export interface TicketStore {
  readonly kind: TicketStoreKind;
  list(): Promise<Ticket[]>;
  findById(id: string): Promise<Ticket | undefined>;
  create(input: CreateTicketInput): Promise<Ticket>;
  update(id: string, patch: Partial<Ticket>): Promise<Ticket | undefined>;
  delete(id: string): Promise<boolean>;
}

export class TicketRepository implements TicketStore {
  readonly kind = "memory";
  private readonly tickets = new Map<string, Ticket>();
  private sequence = 4021;

  constructor() {
    this.seed();
  }

  async list(): Promise<Ticket[]> {
    return [...this.tickets.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<Ticket | undefined> {
    return this.tickets.get(id);
  }

  async create(input: CreateTicketInput): Promise<Ticket> {
    const now = new Date().toISOString();
    const priority = calculatePriority(input.urgency, input.impact);
    const group = selectGroup(input);
    const ticket: Ticket = {
      id: randomUUID(),
      number: `INC-${++this.sequence}`,
      ...input,
      category: "Unclassified",
      priority,
      status: "triaging",
      assignedGroupId: group.id,
      assignedGroupName: group.name,
      sla: buildSla(priority, now),
      tags: [],
      createdAt: now,
      updatedAt: now,
      ai: {
        retrievedSources: [],
        agentMemory: []
      },
      timeline: [
        {
          id: randomUUID(),
          actor: "requester",
          message: input.description,
          createdAt: now
        }
      ],
      followups: [],
      tasks: [],
      approvals: [],
      audit: [
        {
          id: randomUUID(),
          actorId: "system",
          actorName: "Sistema",
          action: "ticket.created",
          message: "Chamado criado pelo portal.",
          createdAt: now
        }
      ]
    };

    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  async update(id: string, patch: Partial<Ticket>): Promise<Ticket | undefined> {
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

  async delete(id: string): Promise<boolean> {
    return this.tickets.delete(id);
  }

  private seed(): void {
    const now = new Date().toISOString();
    const samples: Ticket[] = [
      {
        id: randomUUID(),
        number: "INC-4019",
        type: "incident",
        entityId: "corp",
        entityName: "Corporativo",
        requestSource: "portal",
        requesterEmail: "maria.silva@acme.local",
        department: "Financeiro",
        title: "Falha no fechamento de faturamento",
        description: "O modulo de faturamento retorna erro ao processar notas do lote mensal.",
        affectedService: "ERP Central",
        businessImpact: "Fechamento fiscal bloqueado para a unidade SP.",
        attachments: [],
        category: "ERP",
        urgency: "critical",
        impact: "critical",
        priority: "critical",
        status: "escalated",
        assignedGroupId: "grp-erp",
        assignedGroupName: "N2 ERP e Financeiro",
        sla: buildSla("critical", now),
        tags: ["erp", "billing", "sla-risk"],
        createdAt: now,
        updatedAt: now,
        ai: { retrievedSources: [], agentMemory: [] },
        timeline: [],
        followups: [],
        tasks: [],
        approvals: [],
        audit: []
      },
      {
        id: randomUUID(),
        number: "INC-4020",
        type: "incident",
        entityId: "corp",
        entityName: "Corporativo",
        requestSource: "portal",
        requesterEmail: "joao.costa@acme.local",
        department: "Operacoes",
        title: "VPN desconecta a cada dez minutos",
        description: "Equipe remota perde conexao VPN durante atendimento aos clientes.",
        affectedService: "Rede Corporativa",
        businessImpact: "Atendimento externo instavel.",
        attachments: [],
        category: "Network",
        urgency: "high",
        impact: "medium",
        priority: "high",
        status: "open",
        assignedGroupId: "grp-network",
        assignedGroupName: "N2 Redes e Conectividade",
        sla: buildSla("high", now),
        tags: ["vpn", "network"],
        createdAt: now,
        updatedAt: now,
        ai: { retrievedSources: [], agentMemory: [] },
        timeline: [],
        followups: [],
        tasks: [],
        approvals: [],
        audit: []
      }
    ];

    samples.forEach((ticket) => this.tickets.set(ticket.id, ticket));
  }
}
