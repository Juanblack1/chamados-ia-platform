import { z } from "zod";

export const TicketPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const TicketStatusSchema = z.enum([
  "new",
  "open",
  "triaging",
  "in_progress",
  "waiting_customer",
  "pending_approval",
  "escalated",
  "resolved",
  "closed"
]);
export const TicketTypeSchema = z.enum(["incident", "request"]);
export const TicketImpactSchema = z.enum(["low", "medium", "high", "critical"]);
const ImageDataUrlPattern = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const optionalText = (minimumLength: number, fallback: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
    z.string().trim().min(minimumLength).default(fallback)
  );
const TicketAttachmentSchema = z
  .string()
  .max(2_800_000)
  .refine((value) => isHttpUrl(value) || ImageDataUrlPattern.test(value), {
    message: "Attachment must be an HTTP(S) URL or an image data URL."
  });

export const CreateTicketInputSchema = z.object({
  type: TicketTypeSchema.default("incident"),
  entityId: z.string().min(2).default("corp"),
  entityName: z.string().min(2).default("Corporativo"),
  requestSource: z.enum(["portal", "email", "phone", "chat", "api"]).default("portal"),
  requesterEmail: z.string().email(),
  department: optionalText(2, "Nao informado"),
  title: z.string().min(6).max(120),
  description: z.string().min(20).max(5000),
  affectedService: optionalText(2, "Geral"),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  impact: TicketImpactSchema.default("medium"),
  businessImpact: optionalText(4, "Nao informado pelo solicitante.").pipe(z.string().max(1000)),
  attachments: z.array(TicketAttachmentSchema).max(4).default([])
});

export type TicketPriority = z.infer<typeof TicketPrioritySchema>;
export type TicketStatus = z.infer<typeof TicketStatusSchema>;
export type TicketType = z.infer<typeof TicketTypeSchema>;
export type TicketImpact = z.infer<typeof TicketImpactSchema>;
export type CreateTicketPayload = z.input<typeof CreateTicketInputSchema>;
export type CreateTicketInput = {
  type: TicketType;
  entityId: string;
  entityName: string;
  requestSource: "portal" | "email" | "phone" | "chat" | "api";
  requesterEmail: string;
  department: string;
  title: string;
  description: string;
  affectedService: string;
  urgency: TicketPriority;
  impact: TicketImpact;
  businessImpact: string;
  attachments: string[];
};

export function normalizeCreateTicketInput(input: CreateTicketPayload | CreateTicketInput): CreateTicketInput {
  const parsed = CreateTicketInputSchema.parse(input);
  return {
    type: parsed.type ?? "incident",
    entityId: parsed.entityId ?? "corp",
    entityName: parsed.entityName ?? "Corporativo",
    requestSource: parsed.requestSource ?? "portal",
    requesterEmail: parsed.requesterEmail,
    department: parsed.department ?? "Nao informado",
    title: parsed.title,
    description: parsed.description,
    affectedService: parsed.affectedService ?? "Geral",
    urgency: parsed.urgency ?? "medium",
    impact: parsed.impact ?? "medium",
    businessImpact: parsed.businessImpact ?? "Nao informado pelo solicitante.",
    attachments: parsed.attachments ?? []
  };
}

export type RagSource = {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  relevance: number;
};

export type AgentDecision = {
  agent: string;
  summary: string;
  confidence: number;
  evidence: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type TicketAgentMemoryEntry = {
  id: string;
  ticketId: string;
  agent:
    | "intake-quality"
    | "ticket-triage"
    | "rag-retrieval"
    | "routing"
    | "resolution-drafter"
    | "sla-risk"
    | "ticket-specialist";
  role: "user" | "assistant" | "system";
  actorId: string;
  actorName: string;
  content: string;
  createdAt: string;
  traceId?: string;
  contextTicketIds?: string[];
};

export type TimelineEvent = {
  id: string;
  actor: "requester" | "analyst" | "technician" | "agent" | "system";
  message: string;
  createdAt: string;
};

export type TicketFollowup = {
  id: string;
  authorId: string;
  authorName: string;
  visibility: "public" | "internal";
  message: string;
  createdAt: string;
};

export type TicketTask = {
  id: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  status: "todo" | "doing" | "done";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type TicketApproval = {
  id: string;
  requesterId: string;
  requesterName: string;
  status: "not_required" | "requested" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
};

export type TicketSla = {
  policyId: string;
  label: string;
  responseDueAt: string;
  resolutionDueAt: string;
  breached: boolean;
  paused: boolean;
};

export type TicketAuditEntry = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  message: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  number: string;
  type: TicketType;
  entityId: string;
  entityName: string;
  requestSource: "portal" | "email" | "phone" | "chat" | "api";
  requesterEmail: string;
  department: string;
  title: string;
  description: string;
  affectedService: string;
  businessImpact: string;
  attachments: string[];
  category: string;
  urgency: TicketPriority;
  impact: TicketImpact;
  priority: TicketPriority;
  status: TicketStatus;
  assignedGroupId?: string;
  assignedGroupName?: string;
  assigneeId?: string;
  assigneeName?: string;
  sla: TicketSla;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  ai: {
    triage?: AgentDecision;
    resolutionDraft?: AgentDecision;
    retrievedSources: RagSource[];
    agentMemory?: TicketAgentMemoryEntry[];
  };
  timeline: TimelineEvent[];
  followups: TicketFollowup[];
  tasks: TicketTask[];
  approvals: TicketApproval[];
  audit: TicketAuditEntry[];
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
