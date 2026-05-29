import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { AppEnv } from "../config/env.js";
import type { CreateTicketInput, Ticket } from "./ticket.js";
import type { TicketStore } from "./ticketRepository.js";

export class RedisTicketRepository implements TicketStore {
  readonly kind = "redis";
  private readonly indexKey: string;
  private readonly sequenceKey: string;
  private readonly seededKey: string;

  constructor(
    private readonly redis: Redis,
    private readonly prefix: string
  ) {
    this.indexKey = `${prefix}:tickets:index`;
    this.sequenceKey = `${prefix}:tickets:number-sequence`;
    this.seededKey = `${prefix}:tickets:seeded`;
  }

  static fromEnv(env: AppEnv): RedisTicketRepository {
    const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
    const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
    return new RedisTicketRepository(new Redis({ url, token }), env.TICKET_REDIS_PREFIX);
  }

  async initialize(): Promise<void> {
    await this.redis.setnx(this.sequenceKey, 4021);
    const shouldSeed = await this.redis.setnx(this.seededKey, new Date().toISOString());
    if (shouldSeed !== 1) return;

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
    const ticket: Ticket = {
      id: randomUUID(),
      number: `INC-${sequence}`,
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
}
