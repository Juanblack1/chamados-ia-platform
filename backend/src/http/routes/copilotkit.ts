import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { BuiltInAgent, CopilotRuntime, createCopilotRuntimeHandler, defineTool } from "@copilotkit/runtime/v2";
import { EventType, type BaseEvent, type Message } from "@ag-ui/client";
import type { FastifyInstance, FastifyReply, FastifyRequest, HTTPMethods } from "fastify";
import { z } from "zod";
import type { AgentOrchestrator, TriagePreview } from "../../ai/agents/AgentOrchestrator.js";
import type { ModelGateway } from "../../ai/modelGateway.js";
import { CreateTicketInputSchema, type Ticket } from "../../domain/ticket.js";
import type { TraceRecorder } from "../../observability/traces.js";

export async function registerCopilotKitRoutes(
  app: FastifyInstance,
  orchestrator: AgentOrchestrator,
  llm: ModelGateway,
  traces: TraceRecorder
): Promise<void> {
  const runtime = new CopilotRuntime({
    agents: ({ request }) => ({
      default: createServiceDeskAgent(orchestrator, llm, traces, request)
    })
  });

  const handler = createCopilotRuntimeHandler({
    runtime,
    basePath: "/api/copilotkit"
  });

  const methods: HTTPMethods[] = ["GET", "POST", "OPTIONS"];
  const handleCopilotRequest = async (request: FastifyRequest, reply: FastifyReply) => {
    const host = request.headers.host ?? "localhost";
    const protocol = request.headers["x-forwarded-proto"] ?? "http";
    const url = new URL(request.url, `${Array.isArray(protocol) ? protocol[0] : protocol}://${host}`);
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : serializeBody(request.body);
    const webRequest = new Request(url, {
      method: request.method,
      headers: toHeaders(request.headers),
      body
    });

    reply.hijack();

    try {
      const webResponse = await handler(webRequest);
      reply.raw.statusCode = webResponse.status;
      webResponse.headers.forEach((value, key) => reply.raw.setHeader(key, value));

      if (webResponse.body) {
        Readable.fromWeb(webResponse.body as unknown as WebReadableStream).pipe(reply.raw);
      } else {
        reply.raw.end();
      }
    } catch (error) {
      app.log.warn({ error }, "CopilotKit runtime request failed");
      if (!reply.raw.writableEnded) {
        reply.raw.statusCode = 503;
        reply.raw.setHeader("content-type", "application/json");
        reply.raw.end(
          JSON.stringify({
            error: "copilot_runtime_unavailable",
            message: "CopilotKit runtime failed to process this request."
          })
        );
      }
    }
  };

  app.route({
    method: methods,
    handler: handleCopilotRequest,
    url: "/api/copilotkit"
  });
  app.route({
    method: methods,
    handler: handleCopilotRequest,
    url: "/api/copilotkit/*"
  });
}

function createServiceDeskAgent(
  orchestrator: AgentOrchestrator,
  llm: ModelGateway,
  traces: TraceRecorder,
  request: Request
): BuiltInAgent {
  const traceId = request.headers.get("x-trace-id") ?? randomUUID();
  const tenantId = request.headers.get("x-tenant-id") ?? "default";

  if (llm.isConfigured) {
    return new BuiltInAgent({
      model: llm.languageModel(),
      maxSteps: 4,
      prompt:
        "You are an enterprise service desk copilot. Use tools when the user asks to inspect, preview, or create tickets. Keep answers concise, cite trace IDs when actions run, and require human approval for high-impact or low-confidence decisions.",
      tools: createServiceDeskTools(orchestrator, traces, traceId, tenantId)
    });
  }

  return new BuiltInAgent({
    type: "custom",
    factory: async function* ({ input }): AsyncGenerator<BaseEvent> {
      const userText = latestUserText(input.messages);
      const response = await llm.completeText({
        system:
          "You are an enterprise service desk copilot. Help operators open, triage, and govern IT support tickets. Keep answers concise and audit-friendly.",
        user: `${userText}\n\nTenant: ${tenantId}\nOpen tickets: ${orchestrator.listTickets().length}`,
        fallback: () => fallbackCopilotResponse(userText, orchestrator.listTickets().length)
      });

      const messageId = randomUUID();
      yield { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" };
      yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: response };
      yield { type: EventType.TEXT_MESSAGE_END, messageId };
    }
  });
}

function createServiceDeskTools(orchestrator: AgentOrchestrator, traces: TraceRecorder, traceId: string, tenantId: string) {
  return [
    defineTool({
      name: "list_service_desk_tickets",
      description: "List recent service desk tickets and their AI triage state.",
      parameters: z.object({
        status: z.enum(["open", "triaging", "waiting_customer", "escalated", "resolved"]).optional()
      }),
      execute: async ({ status }) =>
        traces.runSpan(
          {
            traceId,
            name: "tool.list_service_desk_tickets",
            kind: "tool",
            inputSummary: status ?? "all",
            metadata: { tenantId },
            summarizeOutput: (items) => `${items.length} tickets`
          },
          async () =>
            orchestrator
              .listTickets()
              .filter((ticket) => !status || ticket.status === status)
              .slice(0, 20)
              .map((ticket) => ({
                id: ticket.id,
                number: ticket.number,
                title: ticket.title,
                service: ticket.affectedService,
                priority: ticket.priority,
                status: ticket.status,
                confidence: ticket.ai.triage?.confidence ?? null
              }))
        )
    }),
    defineTool({
      name: "preview_ticket_triage",
      description: "Preview category, priority, SLA, confidence, and RAG sources before creating a ticket.",
      parameters: CreateTicketInputSchema,
      execute: async (input) =>
        traces.runSpan<TriagePreview>(
          {
            traceId,
            name: "tool.preview_ticket_triage",
            kind: "tool",
            inputSummary: input.title,
            metadata: { tenantId },
            summarizeOutput: (output) => `${output.triage.category} ${output.triage.priority}`
          },
          async ({ spanId }) => orchestrator.previewTriage(CreateTicketInputSchema.parse(input), { traceId, parentSpanId: spanId })
        )
    }),
    defineTool({
      name: "create_service_desk_ticket",
      description: "Create a service desk ticket, run RAG, triage it, and draft the initial analyst response.",
      parameters: CreateTicketInputSchema,
      execute: async (input) =>
        traces.runSpan<Ticket>(
          {
            traceId,
            name: "tool.create_service_desk_ticket",
            kind: "tool",
            inputSummary: input.title,
            metadata: { tenantId },
            summarizeOutput: (ticket) => `${ticket.number} ${ticket.priority} ${ticket.status}`
          },
          async ({ spanId }) => orchestrator.openTicket(CreateTicketInputSchema.parse(input), { traceId, parentSpanId: spanId })
        )
    })
  ];
}

function latestUserText(messages: Message[]): string {
  const userMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!userMessage) return "Ajude a operar a fila de chamados.";

  const content = userMessage.content;
  if (typeof content === "string") return content;

  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function fallbackCopilotResponse(userText: string, ticketCount: number): string {
  const normalized = userText.toLowerCase();
  if (normalized.includes("abrir") || normalized.includes("criar") || normalized.includes("chamado")) {
    return `Posso apoiar a abertura do chamado. Preencha solicitante, servico afetado, urgencia e impacto; a orquestracao atual fara triagem, RAG e rascunho de resposta. Ha ${ticketCount} chamados na fila.`;
  }

  if (normalized.includes("prioridade") || normalized.includes("sla")) {
    return "Para priorizar, use impacto de negocio, numero de usuarios afetados, servico critico e confianca da triagem. Chamados P1 exigem revisao humana e evidencia auditavel.";
  }

  return `A fila tem ${ticketCount} chamados. Posso ajudar a resumir contexto, sugerir proximas acoes e preparar uma resposta auditavel para o analista.`;
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return body as unknown as BodyInit;
  return JSON.stringify(body);
}

function toHeaders(rawHeaders: Record<string, string | string[] | undefined>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
      continue;
    }
    headers.set(key, value);
  }
  return headers;
}
