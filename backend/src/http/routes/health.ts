import type { FastifyInstance } from "fastify";
import type { ModelGateway } from "../../ai/modelGateway.js";
import type { TicketStoreKind } from "../../domain/ticketRepository.js";

export async function registerHealthRoutes(app: FastifyInstance, llm: ModelGateway, ticketStorage: TicketStoreKind): Promise<void> {
  const payload = async () => ({
    status: "ok",
    llmConfigured: llm.isConfigured,
    modelCascade: llm.modelCascade,
    ticketStorage,
    time: new Date().toISOString()
  });

  app.get("/health", payload);
  app.get("/api/health", payload);
}
