import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";

export const ticketTriageMastraAgent = new Agent({
  id: "ticket-triage",
  name: "Ticket Triage Agent",
  instructions:
    "Classify service desk tickets, retrieve relevant policy context, explain confidence, and require human approval for low-confidence or high-impact decisions.",
  model: process.env.MASTRA_MODEL ?? `google/${process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.5-flash"}`
});

export const ragRetrievalMastraAgent = new Agent({
  id: "rag-retrieval",
  name: "RAG Retrieval Agent",
  instructions:
    "Retrieve approved service desk policy, runbook, and knowledge evidence from Qdrant or the local fallback. Return only source-backed context with relevance and citeable source IDs.",
  model: process.env.MASTRA_MODEL ?? `google/${process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.5-flash"}`
});

export const routingMastraAgent = new Agent({
  id: "routing",
  name: "Routing Agent",
  instructions:
    "Recommend the owning service desk group, technician routing, and operational next tasks based on category, service, impact, SLA, and current assignment rules.",
  model: process.env.MASTRA_MODEL ?? `google/${process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.5-flash"}`
});

export const resolutionDraftMastraAgent = new Agent({
  id: "resolution-drafter",
  name: "Resolution Draft Agent",
  instructions:
    "Draft safe, concise analyst responses and resolution plans using only the active ticket, authorized context, and RAG evidence. Include next actions and cite source IDs.",
  model: process.env.MASTRA_MODEL ?? `google/${process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.5-flash"}`
});

export const slaRiskMastraAgent = new Agent({
  id: "sla-risk",
  name: "SLA Risk Agent",
  instructions:
    "Evaluate SLA breach risk, escalation need, and human approval requirements for service desk tickets using priority, impact, due dates, status, and confidence.",
  model: process.env.MASTRA_MODEL ?? `google/${process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.5-flash"}`
});

export const ticketSpecialistMastraAgent = new Agent({
  id: "ticket-specialist",
  name: "Ticket Specialist Agent",
  instructions:
    "Act as a senior enterprise service desk specialist. Use ticket history, RAG evidence, SLA context, and memory before answering. Keep replies actionable and safe for requester-facing workflows.",
  model: process.env.MASTRA_MODEL ?? `google/${process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.5-flash"}`
});

export const mastraAgents = {
  "ticket-triage": ticketTriageMastraAgent,
  "rag-retrieval": ragRetrievalMastraAgent,
  routing: routingMastraAgent,
  "resolution-drafter": resolutionDraftMastraAgent,
  "sla-risk": slaRiskMastraAgent,
  "ticket-specialist": ticketSpecialistMastraAgent
};

export const serviceDeskMastra = new Mastra({
  agents: mastraAgents
});
