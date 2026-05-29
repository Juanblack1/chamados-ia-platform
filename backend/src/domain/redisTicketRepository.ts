import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { AppEnv } from "../config/env.js";
import type { CreateTicketInput, Ticket } from "./ticket.js";
import type { TicketStore } from "./ticketRepository.js";
import { buildSla, calculatePriority, selectGroup } from "./serviceDeskCatalog.js";

export class RedisTicketRepository implements TicketStore {
  readonly kind = "redis";
  private readonly indexKey: string;
  private readonly sequenceKey: string;
  private readonly seededKey: string;

  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
    private readonly seedSampleData = false
  ) {
    this.indexKey = `${prefix}:tickets:index`;
    this.sequenceKey = `${prefix}:tickets:number-sequence`;
    this.seededKey = `${prefix}:tickets:seeded`;
  }

  static fromEnv(env: AppEnv): RedisTicketRepository {
    const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
    const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
    return new RedisTicketRepository(new Redis({ url, token }), env.TICKET_REDIS_PREFIX, env.TICKET_SEED_SAMPLE_DATA);
  }

  async initialize(): Promise<void> {
    await this.redis.setnx(this.sequenceKey, 4021);
    const shouldSeed = await this.redis.setnx(this.seededKey, new Date().toISOString());
    if (shouldSeed !== 1) return;
    if (!this.seedSampleData) return;

    const existingCount = await this.redis.zcard(this.indexKey);
    if (existingCount > 0) return;

    await Promise.all(seedTickets().map((ticket) => this.save(ticket)));
  }

  async list(): Promise<Ticket[]> {
    const ids = await this.redis.zrange<string[]>(this.indexKey, 0, 99, { rev: true });
    const tickets = await Promise.all(ids.map((id) => this.findById(id)));
    return tickets.filter((ticket): ticket is Ticket => Boolean(ticket));
  }

  async findById(id: string): Promise<Ticket | undefined> {
    return (await this.redis.get<Ticket>(this.ticketKey(id))) ?? undefined;
  }

  async create(input: CreateTicketInput): Promise<Ticket> {
    const sequence = await this.redis.incr(this.sequenceKey);
    const now = new Date().toISOString();
    const priority = calculatePriority(input.urgency, input.impact);
    const group = selectGroup(input);
    const ticket: Ticket = {
      id: randomUUID(),
      number: `INC-${sequence}`,
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
        retrievedSources: []
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

    await this.save(ticket);
    return ticket;
  }

  async update(id: string, patch: Partial<Ticket>): Promise<Ticket | undefined> {
    const current = await this.findById(id);
    if (!current) return undefined;

    const next: Ticket = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await this.save(next);
    return next;
  }

  async delete(id: string): Promise<boolean> {
    const current = await this.findById(id);
    if (!current) return false;

    await Promise.all([this.redis.del(this.ticketKey(id)), this.redis.zrem(this.indexKey, id)]);
    return true;
  }

  private async save(ticket: Ticket): Promise<void> {
    await Promise.all([
      this.redis.set(this.ticketKey(ticket.id), ticket),
      this.redis.zadd(this.indexKey, { score: Date.parse(ticket.createdAt), member: ticket.id })
    ]);
  }

  private ticketKey(id: string): string {
    return `${this.prefix}:tickets:item:${id}`;
  }
}

export function hasRedisTicketStoreConfig(env: AppEnv): boolean {
  return Boolean((env.KV_REST_API_URL && env.KV_REST_API_TOKEN) || (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN));
}

function seedTickets(): Ticket[] {
  const now = new Date().toISOString();
  return [
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
      ai: { retrievedSources: [] },
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
      ai: { retrievedSources: [] },
      timeline: [],
      followups: [],
      tasks: [],
      approvals: [],
      audit: []
    }
  ];
}
