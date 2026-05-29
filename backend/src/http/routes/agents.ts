import type { FastifyInstance } from "fastify";
import type { AgentOrchestrator } from "../../ai/agents/AgentOrchestrator.js";
import { knowledgeArticles, serviceDeskGroups, slaPolicies } from "../../domain/serviceDeskCatalog.js";
import { CreateTicketInputSchema, normalizeCreateTicketInput } from "../../domain/ticket.js";
import type { TraceRecorder } from "../../observability/traces.js";
import { hasPermission, type AuthStore } from "../../security/authStore.js";
import { requireUser } from "../../security/authGuard.js";

export async function registerAgentRoutes(
  app: FastifyInstance,
  orchestrator: AgentOrchestrator,
  traces: TraceRecorder,
  auth: AuthStore
): Promise<void> {
  app.get("/api/agents/runs", async () => orchestrator.listAuditEvents());
  app.get("/api/agents/traces", async () => traces.list());
  app.get("/api/agents/config", async () => orchestrator.describeAiPlatform());
  app.get("/api/catalog/service-desk", async (request) => {
    const user = requireUser(request);
    const users = hasPermission(user, "users.manage") ? await auth.listUsers() : [];
    return {
      currentUser: user,
      users,
      groups: serviceDeskGroups,
      slaPolicies,
      knowledgeArticles
    };
  });

  app.post("/api/agents/triage-preview", async (request, reply) => {
    const parsed = CreateTicketInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_error",
        issues: parsed.error.issues
      });
    }

    return orchestrator.previewTriage(normalizeCreateTicketInput(parsed.data));
  });
}
