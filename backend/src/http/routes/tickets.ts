import type { FastifyInstance } from "fastify";
import { CreateTicketInputSchema } from "../../domain/ticket.js";
import type { AgentOrchestrator } from "../../ai/agents/AgentOrchestrator.js";

export async function registerTicketRoutes(app: FastifyInstance, orchestrator: AgentOrchestrator): Promise<void> {
  app.get("/api/tickets", async () => orchestrator.listTickets());

  app.get<{ Params: { id: string } }>("/api/tickets/:id", async (request, reply) => {
    const ticket = orchestrator.findTicket(request.params.id);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found." });
    return ticket;
  });

  app.post("/api/tickets", async (request, reply) => {
    const parsed = CreateTicketInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_error",
        issues: parsed.error.issues
      });
    }

    const ticket = await orchestrator.openTicket(parsed.data);
    return reply.code(201).send(ticket);
  });
}
