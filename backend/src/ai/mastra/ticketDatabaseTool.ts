import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { TicketPrioritySchema, TicketStatusSchema } from "../../domain/ticket.js";
import { canAccessTicket } from "../../domain/ticketAccess.js";
import type { Ticket, TicketAgentMemoryEntry } from "../../domain/ticket.js";
import type { TicketStore } from "../../domain/ticketRepository.js";
import { permissionKeys, type AppUser } from "../../security/authStore.js";
import { defineServiceDeskTool, type ServiceDeskTool } from "./typedMastraPrimitives.js";

export const TicketDatabaseOperationSchema = z.enum(["list_tickets", "find_ticket", "similar_tickets", "memory_summary"]);
export const TicketDatabaseQuerySchema = z.object({
  operation: TicketDatabaseOperationSchema.default("memory_summary"),
  ticketId: z.string().optional(),
  query: z.string().max(500).optional(),
  status: TicketStatusSchema.optional(),
  includeResolved: z.boolean().default(false),
  limit: z.number().int().min(1).max(20).default(8)
});

export type TicketDatabaseQuery = z.infer<typeof TicketDatabaseQuerySchema>;

export const TicketDatabaseTicketSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  affectedService: z.string(),
  category: z.string(),
  assignedGroupName: z.string().optional(),
  assigneeName: z.string().optional(),
  requesterEmail: z.string().email(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
  memoryCount: z.number().int().nonnegative()
});

export const TicketDatabaseMemorySchema = z.object({
  ticketId: z.string(),
  ticketNumber: z.string(),
  ticketTitle: z.string(),
  agent: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  actorName: z.string(),
  content: z.string(),
  createdAt: z.string(),
  traceId: z.string().optional()
});

export const TicketDatabaseResultSchema = z.object({
  operation: TicketDatabaseOperationSchema,
  storage: z.enum(["memory", "redis"]),
  count: z.number().int().nonnegative(),
  tickets: z.array(TicketDatabaseTicketSchema),
  memories: z.array(TicketDatabaseMemorySchema),
  note: z.string().optional()
});

export type TicketDatabaseResult = z.infer<typeof TicketDatabaseResultSchema>;
type TicketStoreResolver = () => Promise<TicketStore>;

const AppUserContextSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["admin", "manager", "employee", "requester"]),
  entityId: z.string(),
  entityName: z.string(),
  groupIds: z.array(z.string()),
  permissions: z.array(z.enum(permissionKeys)),
  active: z.boolean()
});
const TicketDatabaseRequestContextSchema = z
  .object({
    user: z.union([AppUserContextSchema, z.string()]).optional(),
    currentUser: z.union([AppUserContextSchema, z.string()]).optional()
  })
  .passthrough();

type TicketDatabaseRequestContext = z.infer<typeof TicketDatabaseRequestContextSchema>;

export function createTicketDatabaseTool(ticketStoreOrResolver: TicketStore | TicketStoreResolver): ServiceDeskTool {
  const resolveTicketStore = toTicketStoreResolver(ticketStoreOrResolver);

  return defineServiceDeskTool<TicketDatabaseRequestContext>({
    id: "query-service-desk-database",
    description:
      "Read-only, permission-scoped access to the service desk ticket database and accumulated ticket memory. Use it before answering about prior tickets, similar incidents, status, SLA, requester history, or lessons learned.",
    inputSchema: TicketDatabaseQuerySchema,
    outputSchema: TicketDatabaseResultSchema,
    requestContextSchema: TicketDatabaseRequestContextSchema,
    mcp: {
      annotations: {
        title: "Query Service Desk Database",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    execute: async (input, context) => {
      const query = TicketDatabaseQuerySchema.parse(input);
      const user = parseToolUser(context.requestContext);
      const ticketStore = await resolveTicketStore();
      return queryTicketDatabase(ticketStore, user, query);
    }
  });
}

export async function queryTicketDatabase(
  ticketStore: TicketStore,
  user: AppUser | undefined,
  query: TicketDatabaseQuery
): Promise<TicketDatabaseResult> {
  if (!user) {
    return {
      operation: query.operation,
      storage: ticketStore.kind,
      count: 0,
      tickets: [],
      memories: [],
      note: "Consulta bloqueada: usuario autenticado ausente no contexto da ferramenta."
    };
  }

  const tickets = (await ticketStore.list()).filter((ticket) => canAccessTicket(ticket, user));
  const filtered = applyTicketDatabaseFilter(tickets, query);
  const selected = filtered.slice(0, query.limit);
  const memoryTickets = query.operation === "memory_summary" ? filtered.slice(0, Math.max(query.limit, 10)) : selected;
  const memories = memoryTickets
    .flatMap((ticket) => (ticket.ai.agentMemory ?? []).map((memory) => ({ ticket, memory })))
    .sort((left, right) => right.memory.createdAt.localeCompare(left.memory.createdAt))
    .slice(0, query.limit)
    .map(({ ticket, memory }) => summarizeMemoryForTool(ticket, memory));

  return {
    operation: query.operation,
    storage: ticketStore.kind,
    count: filtered.length,
    tickets: selected.map(summarizeTicketForTool),
    memories,
    note: buildDatabaseToolNote(query, filtered.length)
  };
}

function applyTicketDatabaseFilter(tickets: Ticket[], query: TicketDatabaseQuery): Ticket[] {
  const withoutClosed = query.includeResolved ? tickets : tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const byStatus = query.status ? withoutClosed.filter((ticket) => ticket.status === query.status) : withoutClosed;

  if (query.operation === "find_ticket" && query.ticketId) {
    return byStatus.filter((ticket) => ticket.id === query.ticketId || ticket.number.toLowerCase() === query.ticketId?.toLowerCase());
  }

  if (query.operation === "similar_tickets" || query.operation === "memory_summary") {
    const ranked = rankTickets(byStatus, query.query ?? query.ticketId ?? "");
    return ranked.length ? ranked : byStatus;
  }

  return byStatus;
}

function rankTickets(tickets: Ticket[], query: string): Ticket[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return tickets;

  return tickets
    .map((ticket) => {
      const ticketScore = overlap(queryTokens, tokenize(`${ticket.number} ${ticket.title} ${ticket.description} ${ticket.affectedService} ${ticket.category} ${ticket.tags.join(" ")}`));
      const memoryScore = (ticket.ai.agentMemory ?? []).some((memory) => overlap(queryTokens, tokenize(memory.content)) > 0) ? 0.4 : 0;
      return { ticket, score: ticketScore + memoryScore };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.ticket);
}

function summarizeTicketForTool(ticket: Ticket) {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    affectedService: ticket.affectedService,
    category: ticket.category,
    assignedGroupName: ticket.assignedGroupName,
    assigneeName: ticket.assigneeName,
    requesterEmail: ticket.requesterEmail,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    tags: ticket.tags,
    memoryCount: ticket.ai.agentMemory?.length ?? 0
  };
}

function summarizeMemoryForTool(ticket: Ticket, memory: TicketAgentMemoryEntry) {
  return {
    ticketId: ticket.id,
    ticketNumber: ticket.number,
    ticketTitle: ticket.title,
    agent: memory.agent,
    role: memory.role,
    actorName: memory.actorName,
    content: memory.content.slice(0, 700),
    createdAt: memory.createdAt,
    traceId: memory.traceId
  };
}

function buildDatabaseToolNote(query: TicketDatabaseQuery, count: number): string {
  if (query.operation === "memory_summary") return `${count} chamado(s) autorizado(s) considerados para memoria operacional.`;
  if (query.operation === "similar_tickets") return `${count} chamado(s) parecido(s) encontrados no escopo permitido.`;
  return `${count} chamado(s) retornados no escopo permitido.`;
}

function toTicketStoreResolver(ticketStoreOrResolver: TicketStore | TicketStoreResolver): TicketStoreResolver {
  return typeof ticketStoreOrResolver === "function" ? ticketStoreOrResolver : async () => ticketStoreOrResolver;
}

function parseToolUser(requestContext: RequestContext<TicketDatabaseRequestContext> | undefined): AppUser | undefined {
  const raw = requestContext?.get("user") ?? requestContext?.get("currentUser");
  if (!raw) return undefined;

  if (typeof raw === "string") {
    try {
      const parsed = AppUserContextSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }

  const parsed = AppUserContextSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function tokenize(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function overlap(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return new Set(left.filter((token) => rightSet.has(token))).size;
}
