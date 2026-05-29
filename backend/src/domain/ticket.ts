import { z } from "zod";

export const TicketPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const TicketStatusSchema = z.enum(["open", "triaging", "waiting_customer", "escalated", "resolved"]);
const ImageDataUrlPattern = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const TicketAttachmentSchema = z
  .string()
  .max(2_800_000)
  .refine((value) => isHttpUrl(value) || ImageDataUrlPattern.test(value), {
    message: "Attachment must be an HTTP(S) URL or an image data URL."
  });

export const CreateTicketInputSchema = z.object({
  requesterEmail: z.string().email(),
  department: z.string().min(2),
  title: z.string().min(6).max(120),
  description: z.string().min(20).max(5000),
  affectedService: z.string().min(2),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  businessImpact: z.string().min(4).max(1000),
  attachments: z.array(TicketAttachmentSchema).max(4).default([])
});

export type TicketPriority = z.infer<typeof TicketPrioritySchema>;
export type TicketStatus = z.infer<typeof TicketStatusSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

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

export type TimelineEvent = {
  id: string;
  actor: "requester" | "analyst" | "agent" | "system";
  message: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  number: string;
  requesterEmail: string;
  department: string;
  title: string;
  description: string;
  affectedService: string;
  businessImpact: string;
  attachments: string[];
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  ai: {
    triage?: AgentDecision;
    resolutionDraft?: AgentDecision;
    retrievedSources: RagSource[];
  };
  timeline: TimelineEvent[];
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
