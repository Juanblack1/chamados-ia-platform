import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { AgentOrchestrator } from "../ai/agents/AgentOrchestrator.js";
import { ResolutionDraftAgent } from "../ai/agents/ResolutionDraftAgent.js";
import { TicketTriageAgent } from "../ai/agents/TicketTriageAgent.js";
import { ModelGateway } from "../ai/modelGateway.js";
import { QdrantKnowledgeBase } from "../ai/rag/QdrantKnowledgeBase.js";
import type { AppEnv } from "../config/env.js";
import { DomainEventBus } from "../domain/events.js";
import { TicketRepository } from "../domain/ticketRepository.js";
import { AuditLog } from "../observability/auditLog.js";
import { TraceRecorder } from "../observability/traces.js";
import { registerApiKeyGuard } from "../security/apiKeys.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerCopilotKitRoutes } from "./routes/copilotkit.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerTicketRoutes } from "./routes/tickets.js";

export async function buildServer(env: AppEnv) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  const llm = new ModelGateway(env);
  const knowledge = new QdrantKnowledgeBase(env, llm);
  const tickets = new TicketRepository();
  const events = new DomainEventBus();
  const audit = new AuditLog();
  const traces = new TraceRecorder();
  const triageAgent = new TicketTriageAgent(llm);
  const resolutionAgent = new ResolutionDraftAgent(llm);
  const orchestrator = new AgentOrchestrator(tickets, knowledge, triageAgent, resolutionAgent, events, audit, traces);

  await app.register(cors, {
    origin: [env.FRONTEND_ORIGIN, "http://localhost:5173"],
    credentials: true
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  registerApiKeyGuard(app, env);
  await registerHealthRoutes(app, llm);
  await registerTicketRoutes(app, orchestrator);
  await registerAgentRoutes(app, orchestrator, traces);
  await registerCopilotKitRoutes(app, orchestrator, llm, traces);

  return app;
}
