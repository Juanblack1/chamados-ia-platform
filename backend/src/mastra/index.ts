import { Mastra } from "@mastra/core/mastra";
import { InMemoryStore } from "@mastra/core/storage";
import { serviceDeskMastraScorers } from "../ai/mastra/serviceDeskScorers.js";
import { serviceDeskTools } from "../ai/mastra/serviceDeskTools.js";
import { serviceDeskWorkflows } from "../ai/mastra/serviceDeskWorkflow.js";
import { mastraAgents } from "../ai/mastra/ticketAgent.js";

const defaultStudioOrigins = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3001",
  "http://localhost:3001"
];

export const mastra = new Mastra({
  agents: mastraAgents,
  tools: serviceDeskTools,
  workflows: serviceDeskWorkflows,
  scorers: serviceDeskMastraScorers,
  server: {
    host: process.env.MASTRA_HOST ?? "localhost",
    port: Number(process.env.MASTRA_PORT ?? 4111),
    cors: {
      origin: parseStudioOrigins(process.env.MASTRA_STUDIO_ORIGINS),
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-mastra-client-type",
        "x-mastra-dev-playground"
      ],
      exposeHeaders: ["Content-Length", "X-Requested-With"],
      credentials: true
    }
  },
  storage: new InMemoryStore({ id: "chamados-ia-local-storage" })
});

function parseStudioOrigins(value: string | undefined): string[] {
  const origins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins?.length ? origins : defaultStudioOrigins;
}
