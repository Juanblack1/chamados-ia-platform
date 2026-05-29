import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";
import { parseApiKeys } from "../config/env.js";

export function registerApiKeyGuard(app: FastifyInstance, env: AppEnv): void {
  const keys = parseApiKeys(env);
  if (keys.size === 0 || env.NODE_ENV === "test") return;

  app.addHook("preHandler", async (request, reply) => {
    if (request.method === "OPTIONS" || request.url.startsWith("/health")) return;

    const apiKey = request.headers["x-api-key"];
    const candidate = Array.isArray(apiKey) ? apiKey[0] : apiKey;

    if (!candidate || !keys.has(candidate)) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "A valid x-api-key header is required."
      });
    }
  });
}
