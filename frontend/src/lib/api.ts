export type UserRole = "admin" | "supervisor" | "technician" | "requester";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  entityId: string;
  entityName: string;
  groupIds: string[];
  active: boolean;
};

export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus =
  | "new"
  | "open"
  | "triaging"
  | "in_progress"
  | "waiting_customer"
  | "pending_approval"
  | "escalated"
  | "resolved"
  | "closed";
export type TicketType = "incident" | "request";

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
  impact: TicketPriority;
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
  audit: TicketAuditEntry[];
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
  type: TicketType;
  requesterEmail: string;
  department: string;
  title: string;
  description: string;
  affectedService: string;
  urgency: TicketPriority;
  impact: TicketPriority;
  businessImpact: string;
  attachments: string[];
};

export type IntakeReadiness = "ready" | "needs_info" | "self_service";

export type IntakeQualitySignal = {
  label: string;
  status: "ok" | "warning" | "missing";
  detail: string;
};

export type IntakeSimilarTicket = {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: TicketPriority;
  affectedService: string;
  score: number;
};

export type IntakeAssessment = {
  readiness: IntakeReadiness;
  shouldCreate: boolean;
  qualityScore: number;
  summary: string;
  blockedReason?: string;
  detectedIntent: string;
  sentiment: "neutral" | "negative" | "urgent";
  language: "pt-BR" | "en" | "unknown";
  missingInformation: string[];
  clarificationQuestions: string[];
  qualitySignals: IntakeQualitySignal[];
  suggestedFields: {
    type: TicketType;
    category: string;
    priority: TicketPriority;
    urgency: TicketPriority;
    impact: TicketPriority;
    affectedService: string;
    assignedGroupId: string;
    assignedGroupName: string;
    tags: string[];
    title?: string;
  };
  selfService: {
    canDeflect: boolean;
    confidence: number;
    answer: string;
    sources: RagSource[];
  };
  ragSources: RagSource[];
  similarTickets: IntakeSimilarTicket[];
  workflow: string[];
};

export type ServiceDeskCatalog = {
  currentUser: AppUser;
  users: AppUser[];
  groups: Array<{ id: string; name: string; services: string[] }>;
  slaPolicies: Array<{ id: string; name: string; priority: TicketPriority; responseMinutes: number; resolutionMinutes: number }>;
  knowledgeArticles: Array<{ id: string; title: string; source: string; category: string; updatedAt: string }>;
};

export type CreateUserPayload = {
  email: string;
  name: string;
  role: UserRole;
  entityId?: string;
  entityName?: string;
  groupIds?: string[];
  active?: boolean;
  password: string;
};

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "password">> & {
  password?: string;
};

export type UpdateProfilePayload = {
  name: string;
  entityName?: string;
  password?: string;
};

export type TicketChatStreamEvent =
  | {
      type: "status";
      phase: "thinking" | "model" | "fallback" | "done";
      message: string;
      model?: string;
    }
  | {
      type: "delta";
      text: string;
      model: string;
    }
  | {
      type: "error";
      message: string;
      model?: string;
    }
  | {
      type: "ticket";
      ticket: Ticket;
      messages: TicketAgentMemoryEntry[];
    };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function login(email: string, password: string): Promise<{ user: AppUser; expiresAt: string }> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function getSession(): Promise<{ user: AppUser }> {
  return request("/auth/me");
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

export async function listTickets(): Promise<Ticket[]> {
  return request("/tickets");
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  return request("/tickets", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function assessTicketIntake(payload: CreateTicketPayload): Promise<IntakeAssessment> {
  return request("/tickets/intake-assessment", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function assignTicket(ticketId: string): Promise<Ticket> {
  return request(`/tickets/${ticketId}/assign`, { method: "POST", body: JSON.stringify({}) });
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
  return request(`/tickets/${ticketId}/status`, { method: "POST", body: JSON.stringify({ status }) });
}

export async function addFollowup(ticketId: string, message: string, visibility: "public" | "internal"): Promise<Ticket> {
  return request(`/tickets/${ticketId}/followups`, {
    method: "POST",
    body: JSON.stringify({ message, visibility })
  });
}

export async function addTask(ticketId: string, title: string, description?: string): Promise<Ticket> {
  return request(`/tickets/${ticketId}/tasks`, {
    method: "POST",
    body: JSON.stringify({ title, description })
  });
}

export async function completeTask(ticketId: string, taskId: string): Promise<Ticket> {
  return request(`/tickets/${ticketId}/tasks/${taskId}/complete`, { method: "POST" });
}

export async function resolveTicket(ticketId: string, message: string): Promise<Ticket> {
  return request(`/tickets/${ticketId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export async function deleteTicket(ticketId: string): Promise<void> {
  await request(`/tickets/${ticketId}`, { method: "DELETE" });
}

export async function chatWithTicket(ticketId: string, message: string): Promise<{ ticket: Ticket; messages: TicketAgentMemoryEntry[] }> {
  return request(`/tickets/${ticketId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export async function streamTicketChat(
  ticketId: string,
  message: string,
  onEvent: (event: TicketChatStreamEvent) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? "Nao foi possivel conversar com o agente.");
  }

  if (!response.body) throw new Error("Streaming indisponivel neste navegador.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      onEvent(JSON.parse(dataLine.slice(6)) as TicketChatStreamEvent);
    }

    if (done) break;
  }
}

export async function listAgentTraces(): Promise<TraceSpan[]> {
  return request("/agents/traces");
}

export async function getCatalog(): Promise<ServiceDeskCatalog> {
  return request("/catalog/service-desk");
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<{ user: AppUser }> {
  return request("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function createUser(payload: CreateUserPayload): Promise<{ user: AppUser }> {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateUser(userId: string, payload: UpdateUserPayload): Promise<{ user: AppUser }> {
  return request(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? "Nao foi possivel concluir a acao.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
