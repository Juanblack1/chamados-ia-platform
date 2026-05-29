import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CreateTicketInputSchema, TicketStatusSchema, normalizeCreateTicketInput } from "../../domain/ticket.js";
import type { AgentOrchestrator } from "../../ai/agents/AgentOrchestrator.js";
import { requireUser } from "../../security/authGuard.js";

export async function registerTicketRoutes(app: FastifyInstance, orchestrator: AgentOrchestrator): Promise<void> {
  app.get("/api/tickets", async (request) => orchestrator.listTicketsForUser(requireUser(request)));

  app.post("/api/tickets/intake-assessment", async (request, reply) => {
    const parsed = CreateTicketInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Preencha titulo, descricao, solicitante, servico e impacto para analisar o chamado.",
        issues: parsed.error.issues
      });
    }

    const user = requireUser(request);
    const payload = normalizeCreateTicketInput(user.role === "requester" ? { ...parsed.data, requesterEmail: user.email } : parsed.data);
    return orchestrator.assessIntake(payload, {}, user);
  });

  app.get<{ Params: { id: string } }>("/api/tickets/:id", async (request, reply) => {
    const ticket = await orchestrator.findTicketForUser(request.params.id, requireUser(request));
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

    const user = requireUser(request);
    const payload = normalizeCreateTicketInput(user.role === "requester" ? { ...parsed.data, requesterEmail: user.email } : parsed.data);
    const assessment = await orchestrator.assessIntake(payload, {}, user);
    if (!assessment.shouldCreate) {
      return reply.code(422).send({
        error: "intake_not_ready",
        message: assessment.blockedReason ?? assessment.summary,
        assessment
      });
    }

    const ticket = await orchestrator.openTicket(payload, {}, user, assessment);
    return reply.code(201).send(ticket);
  });

  app.post<{ Params: { id: string } }>("/api/tickets/:id/assign", async (request, reply) => {
    const parsed = z.object({ assigneeId: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const user = requireUser(request);
    const ticket = await orchestrator.assignTicket(request.params.id, user);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found or not assignable." });
    return ticket;
  });

  app.post<{ Params: { id: string } }>("/api/tickets/:id/status", async (request, reply) => {
    const parsed = z.object({ status: TicketStatusSchema }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const ticket = await orchestrator.updateStatus(request.params.id, requireUser(request), parsed.data.status);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found or status transition not allowed." });
    return ticket;
  });

  app.post<{ Params: { id: string } }>("/api/tickets/:id/followups", async (request, reply) => {
    const parsed = z
      .object({
        message: z.string().min(3).max(2000),
        visibility: z.enum(["public", "internal"]).default("public")
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const ticket = await orchestrator.addFollowup(request.params.id, requireUser(request), parsed.data.message, parsed.data.visibility);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found or follow-up not allowed." });
    return ticket;
  });

  app.post<{ Params: { id: string } }>("/api/tickets/:id/tasks", async (request, reply) => {
    const parsed = z
      .object({
        title: z.string().min(3).max(120),
        description: z.string().max(1000).optional()
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const ticket = await orchestrator.addTask(request.params.id, requireUser(request), parsed.data.title, parsed.data.description);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found or task not allowed." });
    return ticket;
  });

  app.post<{ Params: { id: string; taskId: string } }>("/api/tickets/:id/tasks/:taskId/complete", async (request, reply) => {
    const ticket = await orchestrator.completeTask(request.params.id, request.params.taskId, requireUser(request));
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found or task not allowed." });
    return ticket;
  });

  app.post<{ Params: { id: string } }>("/api/tickets/:id/resolve", async (request, reply) => {
    const parsed = z.object({ message: z.string().min(6).max(2000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const ticket = await orchestrator.resolveTicket(request.params.id, requireUser(request), parsed.data.message);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found or resolution not allowed." });
    return ticket;
  });

  app.post<{ Params: { id: string } }>("/api/tickets/:id/chat", async (request, reply) => {
    const parsed = z.object({ message: z.string().trim().min(2).max(2000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const ticket = await orchestrator.chatWithTicket(request.params.id, requireUser(request), parsed.data.message);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found or chat not allowed." });
    return {
      ticket,
      messages: ticket.ai.agentMemory ?? []
    };
  });

  app.delete<{ Params: { id: string } }>("/api/tickets/:id", async (request, reply) => {
    const user = requireUser(request);
    if (user.role !== "admin") return reply.code(403).send({ error: "forbidden", message: "Only admins can delete tickets." });

    const deleted = await orchestrator.deleteTicket(request.params.id, user);
    if (!deleted) return reply.code(404).send({ error: "not_found", message: "Ticket not found." });
    return reply.code(204).send();
  });
}
