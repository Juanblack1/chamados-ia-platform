import type { FastifyInstance } from "fastify";
import { once } from "node:events";
import { z } from "zod";
import {
  AttachmentValidationError,
  finalizeTicketAttachments,
  prepareTicketAttachments,
  type TicketAttachmentStore
} from "../../domain/attachmentStore.js";
import {
  CreateTicketInputSchema,
  TicketAiFeedbackInputSchema,
  TicketStatusSchema,
  normalizeCreateTicketInput,
  type CreateTicketInput
} from "../../domain/ticket.js";
import type { AgentOrchestrator } from "../../ai/agents/AgentOrchestrator.js";
import { requireUser } from "../../security/authGuard.js";
import { hasPermission, type AuthStore } from "../../security/authStore.js";

export async function registerTicketRoutes(
  app: FastifyInstance,
  orchestrator: AgentOrchestrator,
  attachmentStore: TicketAttachmentStore,
  auth: AuthStore
): Promise<void> {
  app.get("/api/tickets", async (request) => orchestrator.listTicketsForUser(requireUser(request)));

  app.post("/api/tickets/intake-assessment", async (request, reply) => {
    const parsed = CreateTicketInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Preencha solicitante e descricao para analisar o chamado.",
        issues: parsed.error.issues
      });
    }

    const user = requireUser(request);
    if (!hasPermission(user, "tickets.open")) return reply.code(403).send({ error: "forbidden", message: "Voce nao tem permissao para abrir chamados." });
    const payload = normalizeCreateTicketInput(hasPermission(user, "tickets.work") ? parsed.data : { ...parsed.data, requesterEmail: user.email });
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
    if (!hasPermission(user, "tickets.open")) return reply.code(403).send({ error: "forbidden", message: "Voce nao tem permissao para abrir chamados." });
    const payload = normalizeCreateTicketInput(hasPermission(user, "tickets.work") ? parsed.data : { ...parsed.data, requesterEmail: user.email });
    const prepared = await prepareTicketAttachments(attachmentStore, payload.attachments, user.id).catch((cause: unknown) => {
      if (cause instanceof AttachmentValidationError) return cause;
      throw cause;
    });
    if (prepared instanceof AttachmentValidationError) {
      return reply.code(400).send({ error: "attachment_rejected", message: prepared.message });
    }

    const storageSafePayload = { ...payload, attachments: prepared.attachments };
    try {
      const assessment = await orchestrator.assessIntake(storageSafePayload, {}, user);
      if (!assessment.shouldCreate) {
        await attachmentStore.deletePending(prepared.pendingIds);
        return reply.code(422).send({
          error: "intake_not_ready",
          message: assessment.blockedReason ?? assessment.summary,
          assessment
        });
      }

      const aiClassifiedPayload = applyIntakeAssessmentSuggestions(storageSafePayload, assessment);
      const ticket = await orchestrator.openTicket(aiClassifiedPayload, {}, user, assessment);
      const finalizedAttachments = await finalizeTicketAttachments(attachmentStore, ticket.id, prepared);
      const responseTicket =
        finalizedAttachments.some((attachment, index) => attachment !== storageSafePayload.attachments[index])
          ? await orchestrator.replaceTicketAttachments(ticket.id, user, finalizedAttachments)
          : ticket;
      return reply.code(201).send(responseTicket ?? ticket);
    } catch (cause) {
      await attachmentStore.deletePending(prepared.pendingIds);
      throw cause;
    }
  });

  app.get<{ Params: { id: string; attachmentId: string } }>("/api/tickets/:id/attachments/:attachmentId", async (request, reply) => {
    const user = requireUser(request);
    const ticket = await orchestrator.findTicketForUser(request.params.id, user);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found." });

    const attachment = await attachmentStore.get(ticket.id, request.params.attachmentId);
    if (!attachment) return reply.code(404).send({ error: "not_found", message: "Attachment not found." });

    reply
      .header("content-type", attachment.contentType)
      .header("content-length", attachment.byteLength)
      .header("cache-control", "private, max-age=300")
      .header("content-disposition", `inline; filename="${attachment.fileName}"`);
    return attachment.content;
  });

  app.post<{ Params: { id: string } }>("/api/tickets/:id/assign", async (request, reply) => {
    const parsed = z.object({ assigneeId: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const user = requireUser(request);
    const assignee = parsed.data.assigneeId ? await auth.findUserById(parsed.data.assigneeId) : undefined;
    if (parsed.data.assigneeId && !assignee) {
      return reply.code(404).send({ error: "not_found", message: "Target assignee not found." });
    }

    const ticket = await orchestrator.assignTicket(request.params.id, user, assignee);
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

  app.post<{ Params: { id: string } }>("/api/tickets/:id/approval", async (request, reply) => {
    const parsed = z
      .object({
        decision: z.enum(["approved", "rejected"]),
        note: z.string().trim().max(1000).optional()
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const ticket = await orchestrator.decideApproval(request.params.id, requireUser(request), parsed.data.decision, parsed.data.note);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found, approval not pending, or approval not allowed." });
    return ticket;
  });

  app.post<{ Params: { id: string } }>("/api/tickets/:id/ai-feedback", async (request, reply) => {
    const parsed = TicketAiFeedbackInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const ticket = await orchestrator.recordAiFeedback(request.params.id, requireUser(request), parsed.data);
    if (!ticket) return reply.code(404).send({ error: "not_found", message: "Ticket not found, AI decision missing, or feedback not allowed." });
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

  app.post<{ Params: { id: string } }>("/api/tickets/:id/chat/stream", async (request, reply) => {
    const parsed = z.object({ message: z.string().trim().min(2).max(2000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const user = requireUser(request);
    const existing = await orchestrator.findTicketForUser(request.params.id, user);
    if (!existing) return reply.code(404).send({ error: "not_found", message: "Ticket not found or chat not allowed." });

    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });

    try {
      for await (const event of orchestrator.streamChatWithTicket(request.params.id, user, parsed.data.message)) {
        const ok = reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        if (!ok) await once(reply.raw, "drain");
      }
    } finally {
      reply.raw.end();
    }
  });

  app.delete<{ Params: { id: string } }>("/api/tickets/:id", async (request, reply) => {
    const user = requireUser(request);
    if (!hasPermission(user, "tickets.delete")) return reply.code(403).send({ error: "forbidden", message: "Somente usuarios com permissao podem excluir chamados." });

    const deleted = await orchestrator.deleteTicket(request.params.id, user);
    if (!deleted) return reply.code(404).send({ error: "not_found", message: "Ticket not found." });
    return reply.code(204).send();
  });
}

function applyIntakeAssessmentSuggestions(input: CreateTicketInput, assessment: Awaited<ReturnType<AgentOrchestrator["assessIntake"]>>): CreateTicketInput {
  return {
    ...input,
    type: assessment.suggestedFields.type,
    title: assessment.suggestedFields.title ?? input.title,
    affectedService: assessment.suggestedFields.affectedService,
    urgency: assessment.suggestedFields.urgency,
    impact: assessment.suggestedFields.impact,
    businessImpact: assessment.suggestedFields.businessImpact ?? input.businessImpact
  };
}
