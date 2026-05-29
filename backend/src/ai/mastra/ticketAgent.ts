import { Agent } from "@mastra/core/agent";

export const ticketTriageMastraAgent = new Agent({
  id: "ticket-triage",
  name: "Ticket Triage Agent",
  instructions:
    "Classify service desk tickets, retrieve relevant policy context, explain confidence, and require human approval for low-confidence or high-impact decisions.",
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
  "ticket-specialist": ticketSpecialistMastraAgent
};
