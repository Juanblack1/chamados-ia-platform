export type UserRole = "admin" | "manager" | "employee" | "requester";
export type PermissionKey = "tickets.open" | "tickets.read" | "tickets.work" | "tickets.delete" | "users.manage";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  entityId: string;
  entityName: string;
  groupIds: string[];
  permissions: PermissionKey[];
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

export type TicketAiFeedback = {
  id: string;
  decision: "triage" | "resolution_draft";
  rating: "useful" | "needs_review" | "incorrect";
  note?: string;
  actorId: string;
  actorName: string;
  createdAt: string;
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
    | "ticket-memory"
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
  reason?: string;
  decidedById?: string;
  decidedByName?: string;
  decisionNote?: string;
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
    feedback?: TicketAiFeedback[];
  };
  timeline: TimelineEvent[];
  followups: TicketFollowup[];
  tasks: TicketTask[];
  approvals: TicketApproval[];
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

export type AgentAuditEntry = {
  id: string;
  eventType: string;
  message: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type ServiceDeskEvalScorerResult = {
  id: string;
  score: number;
  passed: boolean;
  reason: string;
};

export type ServiceDeskEvalCaseReport = {
  id: string;
  name: string;
  passed: boolean;
  score: number;
  summary: string;
  durationMs: number;
  modelRoute: string;
  executionMode: "model-cascade" | "deterministic-fallback";
  sourceIds: string[];
  expectedSpans: string[];
  observedSpans: string[];
  scorers: ServiceDeskEvalScorerResult[];
};

export type ServiceDeskEvalScorerSummary = {
  id: string;
  passRate: number;
  averageScore: number;
  passed: number;
  failed: number;
  failedCases: string[];
};

export type ServiceDeskEvalReport = {
  suiteId: "service-desk-agent-baseline";
  generatedAt: string;
  score: number;
  passRate: number;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  modelRoute: string;
  executionMode: "model-cascade" | "deterministic-fallback";
  cases: ServiceDeskEvalCaseReport[];
  scorers: ServiceDeskEvalScorerSummary[];
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
    businessImpact?: string;
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
  knowledgeArticles: Array<{
    id: string;
    title: string;
    source: string;
    category: string;
    updatedAt: string;
    ownerGroupId: string;
    reviewCadenceDays: number;
    status: "active" | "needs_review";
  }>;
  openingTemplates: Array<{
    id: string;
    category: string;
    affectedService: string;
    type: TicketType;
    assignedGroupId: string;
    titlePlaceholder: string;
    descriptionPrompt: string;
    businessImpactPrompt: string;
    requiredFields: string[];
    examples: string[];
  }>;
};

export type CreateUserPayload = {
  email: string;
  name: string;
  role: UserRole;
  entityId?: string;
  entityName?: string;
  groupIds?: string[];
  permissions?: PermissionKey[];
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
