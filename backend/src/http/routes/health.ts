import type { FastifyInstance } from "fastify";
import type { ModelGateway } from "../../ai/modelGateway.js";

export async function registerHealthRoutes(app: FastifyInstance, llm: ModelGateway): Promise<void> {
  const payload = async () => ({
    status: "ok",
    llmConfigured: llm.isConfigured,
    time: new Date().toISOString()
  });

  app.get("/health", payload);
  app.get("/api/health", payload);
}
