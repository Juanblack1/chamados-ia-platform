export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "open" | "triaging" | "waiting_customer" | "escalated" | "resolved";

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

export type TraceSpan = {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: "workflow" | "rag" | "agent" | "llm" | "tool";
  status: "ok" | "error";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  inputSummary?: string;
  outputSummary?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type CreateTicketPayload = {
  requesterEmail: string;
  department: string;
  title: string;
  description: string;
  affectedService: string;
  urgency: TicketPriority;
  businessImpact: string;
  attachments: string[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");
const API_KEY = import.meta.env.VITE_API_KEY ?? "local-dev-key";

const headers = {
  "content-type": "application/json",
  "x-api-key": API_KEY
};

export async function listTickets(): Promise<Ticket[]> {
  const response = await fetch(`${API_BASE_URL}/tickets`, { headers });
  if (!response.ok) throw new Error("Could not load tickets.");
  return response.json() as Promise<Ticket[]>;
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? "Could not create ticket.");
  }

  return response.json() as Promise<Ticket>;
}

export async function listAgentRuns() {
  const response = await fetch(`${API_BASE_URL}/agents/runs`, { headers });
  if (!response.ok) throw new Error("Could not load agent runs.");
  return response.json();
}

export async function listAgentTraces(): Promise<TraceSpan[]> {
  const response = await fetch(`${API_BASE_URL}/agents/traces`, { headers });
  if (!response.ok) throw new Error("Could not load agent traces.");
  return response.json() as Promise<TraceSpan[]>;
}
