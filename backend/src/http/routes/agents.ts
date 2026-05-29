import type { FastifyInstance } from "fastify";
import type { AgentOrchestrator } from "../../ai/agents/AgentOrchestrator.js";
import { CreateTicketInputSchema } from "../../domain/ticket.js";
import type { TraceRecorder } from "../../observability/traces.js";

export async function registerAgentRoutes(
  app: FastifyInstance,
  orchestrator: AgentOrchestrator,
  traces: TraceRecorder
): Promise<void> {
  app.get("/api/agents/runs", async () => orchestrator.listAuditEvents());
  app.get("/api/agents/traces", async () => traces.list());

  app.post("/api/agents/triage-preview", async (request, reply) => {
    const parsed = CreateTicketInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_error",
        issues: parsed.error.issues
      });
    }

    return orchestrator.previewTriage(parsed.data);
  });
}
