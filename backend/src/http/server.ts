import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { AgentOrchestrator } from "../ai/agents/AgentOrchestrator.js";
import { ResolutionDraftAgent } from "../ai/agents/ResolutionDraftAgent.js";
import { TicketSpecialistChatAgent } from "../ai/agents/TicketSpecialistChatAgent.js";
import { TicketTriageAgent } from "../ai/agents/TicketTriageAgent.js";
import { ModelGateway } from "../ai/modelGateway.js";
import { createTicketDatabaseTool } from "../ai/mastra/ticketDatabaseTool.js";
import { QdrantKnowledgeBase } from "../ai/rag/QdrantKnowledgeBase.js";
import type { AppEnv } from "../config/env.js";
import { DomainEventBus } from "../domain/events.js";
import { createTicketAttachmentStore } from "../domain/attachmentStore.js";
import { createTicketStore } from "../domain/ticketStore.js";
import { AuditLog } from "../observability/auditLog.js";
import { TraceRecorder } from "../observability/traces.js";
import { createAuthStore } from "../security/authStore.js";
import { registerAccessGuard } from "../security/authGuard.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerAuthRoutes } from "./routes/auth.js";
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
  const tickets = await createTicketStore(env);
  const attachmentStore = createTicketAttachmentStore(env);
  const auth = await createAuthStore(env);
  const events = new DomainEventBus();
  const audit = new AuditLog();
  const traces = new TraceRecorder();
  const triageAgent = new TicketTriageAgent(llm);
  const resolutionAgent = new ResolutionDraftAgent(llm);
  const ticketDatabaseTool = createTicketDatabaseTool(tickets);
  const specialistAgent = new TicketSpecialistChatAgent(llm, ticketDatabaseTool);
  const orchestrator = new AgentOrchestrator(tickets, knowledge, triageAgent, resolutionAgent, specialistAgent, events, audit, traces);

  await app.register(cors, {
    origin: [env.FRONTEND_ORIGIN, "http://localhost:5173"],
    credentials: true
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  registerAccessGuard(app, env, auth);
  await registerHealthRoutes(app, llm, tickets.kind);
  await registerAuthRoutes(app, env, auth);
  await registerTicketRoutes(app, orchestrator, attachmentStore);
  await registerAgentRoutes(app, orchestrator, traces, auth);
  await registerCopilotKitRoutes(app, orchestrator, llm, traces);

  return app;
}
