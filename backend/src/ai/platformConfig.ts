export type AiPlatformFocus = "all" | "agents" | "rag" | "workflow" | "tool_calls" | "observability" | "deployment";

export const serviceDeskAgentCatalog = [
  {
    id: "intake-quality",
    name: "Intake Quality Agent",
    framework: "Mastra Agent",
    responsibility: "Avalia se a abertura tem contexto acionavel, sugere campos, detecta lacunas e evita chamados sem sentido.",
    memory: "Resumo de qualidade e bloqueios ficam em agentMemory e metadata da triagem quando o chamado e criado."
  },
  {
    id: "ticket-triage",
    name: "Ticket Triage Agent",
    framework: "Mastra Agent",
    responsibility: "Classifica categoria, prioridade, SLA, tags, confianca e informacoes faltantes.",
    memory: "Persiste resumo e decisao em ticket.ai.agentMemory e ticket.ai.triage."
  },
  {
    id: "rag-retrieval",
    name: "RAG Retrieval Agent",
    framework: "Mastra Agent",
    responsibility: "Busca politicas, runbooks e artigos em Qdrant com fallback local.",
    memory: "Fontes usadas ficam anexadas ao chamado em ticket.ai.retrievedSources."
  },
  {
    id: "routing",
    name: "Routing Agent",
    framework: "Mastra Agent",
    responsibility: "Sugere grupo tecnico, responsavel e proximas tarefas operacionais.",
    memory: "Roteamento fica refletido no grupo atribuido, timeline e auditoria."
  },
  {
    id: "resolution-drafter",
    name: "Resolution Draft Agent",
    framework: "Mastra Agent",
    responsibility: "Gera rascunho de resposta e plano de acao citando evidencias RAG.",
    memory: "Persiste rascunho em ticket.ai.agentMemory e ticket.ai.resolutionDraft."
  },
  {
    id: "sla-risk",
    name: "SLA Risk Agent",
    framework: "Mastra Agent",
    responsibility: "Avalia risco de violacao de SLA, criticidade e necessidade de escalacao.",
    memory: "Risco fica registrado em tags, metadata, timeline, agentMemory e traces."
  },
  {
    id: "ticket-specialist",
    name: "Ticket Specialist Agent",
    framework: "Mastra Agent",
    responsibility: "Conversa no chamado usando chamado ativo, fila autorizada, memoria e RAG.",
    memory: "Cada turno do chat e persistido em ticket.ai.agentMemory com traceId e contextTicketIds."
  }
] as const;

export const serviceDeskWorkflow = {
  id: "open-ticket-sdd-workflow",
  engine: "AgentOrchestrator",
  sddSpecs: ["docs/specs/open-ticket.sdd.md", "docs/specs/agent-governance.sdd.md"],
  steps: [
    "ticket.created",
    "agent.intake-quality",
    "agent.rag-retrieval",
    "rag.search",
    "agent.ticket-triage",
    "agent.routing",
    "agent.sla-risk",
    "agent.resolution-draft",
    "ticket.triaged",
    "audit.recorded"
  ],
  humanApproval: "Decisoes de alto impacto, baixa confianca e solucao final continuam sob aprovacao humana."
} as const;

export const serviceDeskToolCatalog = [
  "describe_ai_service_desk",
  "search_service_desk_knowledge",
  "list_service_desk_tickets",
  "assess_ticket_intake",
  "preview_ticket_triage",
  "create_service_desk_ticket"
] as const;

export function describeAiServiceDeskPlatform(focus: AiPlatformFocus = "all") {
  const base = {
    product: "Service Desk IA",
    llm: "Google AI Studio primario e x.ai Grok em cascata via Vercel AI SDK (@ai-sdk/google, @ai-sdk/xai e ai)",
    mastra: {
      registered: true,
      agents: serviceDeskAgentCatalog
    },
    workflow: serviceDeskWorkflow,
    rag: {
      vectorStore: "Qdrant",
      collection: "service_desk_knowledge",
      embeddings: "gemini-embedding-001",
      fallback: "Busca local na knowledgeSeed quando Qdrant ou embeddings externos nao estao disponiveis.",
      attachedToTickets: "ticket.ai.retrievedSources"
    },
    toolCalls: {
      runtime: "CopilotKit Runtime v2",
      tools: serviceDeskToolCatalog,
      tracing: "Cada tool call relevante gera span kind=tool em TraceRecorder."
    },
    observability: {
      traces: "TraceRecorder registra spans workflow, rag, agent, llm e tool com traceId, parentSpanId, duracao e status.",
      audit: "AuditLog recebe eventos de dominio e entradas de ticket.audit para governanca.",
      endpoints: ["/api/agents/traces", "/api/agents/runs", "/api/agents/config"]
    },
    deployment: {
      docker: ["backend/Dockerfile", "frontend/Dockerfile", "docker-compose.yml"],
      kubernetes: ["infra/k8s/backend-deployment.yaml", "infra/k8s/frontend-deployment.yaml", "infra/k8s/platform-config.yaml"],
      azureDevOps: ["azure-pipelines.yml", "infra/azure/azure-pipelines.yml"],
      vercel: ["vercel.json", "api/[...].ts"]
    }
  };

  if (focus === "agents") return { agents: base.mastra.agents };
  if (focus === "rag") return { rag: base.rag };
  if (focus === "workflow") return { workflow: base.workflow };
  if (focus === "tool_calls") return { toolCalls: base.toolCalls };
  if (focus === "observability") return { observability: base.observability };
  if (focus === "deployment") return { deployment: base.deployment };
  return base;
}
