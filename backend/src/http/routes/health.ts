import type { FastifyInstance } from "fastify";
import type { ModelGateway } from "../../ai/modelGateway.js";

export async function registerHealthRoutes(app: FastifyInstance, llm: ModelGateway): Promise<void> {
  app.get("/health", async () => ({
    status: "ok",
    llmConfigured: llm.isConfigured,
    time: new Date().toISOString()
  }));
}
