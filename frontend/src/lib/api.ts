import type {
  AgentAuditEntry,
  AppUser,
  CreateTicketPayload,
  CreateUserPayload,
  IntakeAssessment,
  ServiceDeskCatalog,
  ServiceDeskEvalReport,
  Ticket,
  TicketAgentMemoryEntry,
  TicketAiFeedback,
  TicketChatStreamEvent,
  TicketStatus,
  TraceSpan,
  UpdateProfilePayload,
  UpdateUserPayload
} from "./apiTypes";

export type {
  AgentAuditEntry,
  AgentDecision,
  AppUser,
  CreateTicketPayload,
  CreateUserPayload,
  IntakeAssessment,
  IntakeQualitySignal,
  IntakeReadiness,
  IntakeSimilarTicket,
  PermissionKey,
  RagSource,
  ServiceDeskCatalog,
  ServiceDeskEvalCaseReport,
  ServiceDeskEvalReport,
  ServiceDeskEvalScorerResult,
  ServiceDeskEvalScorerSummary,
  Ticket,
  TicketAgentMemoryEntry,
  TicketAiFeedback,
  TicketApproval,
  TicketAuditEntry,
  TicketChatStreamEvent,
  TicketFollowup,
  TicketPriority,
  TicketSla,
  TicketStatus,
  TicketTask,
  TicketType,
  TimelineEvent,
  TraceSpan,
  UpdateProfilePayload,
  UpdateUserPayload,
  UserRole
} from "./apiTypes";

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
  await request("/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });
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

export async function assignTicket(ticketId: string, assigneeId?: string): Promise<Ticket> {
  return request(`/tickets/${ticketId}/assign`, { method: "POST", body: JSON.stringify(assigneeId ? { assigneeId } : {}) });
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
  return request(`/tickets/${ticketId}/status`, { method: "POST", body: JSON.stringify({ status }) });
}

export async function decideTicketApproval(ticketId: string, decision: "approved" | "rejected", note?: string): Promise<Ticket> {
  return request(`/tickets/${ticketId}/approval`, {
    method: "POST",
    body: JSON.stringify({ decision, note })
  });
}

export async function recordAiFeedback(
  ticketId: string,
  payload: { decision: TicketAiFeedback["decision"]; rating: TicketAiFeedback["rating"]; note?: string }
): Promise<Ticket> {
  return request(`/tickets/${ticketId}/ai-feedback`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
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

export async function listAgentRuns(): Promise<AgentAuditEntry[]> {
  return request("/agents/runs");
}

export async function listAgentEvalReport(): Promise<ServiceDeskEvalReport> {
  return request("/agents/evals");
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
