import { Mastra } from "@mastra/core/mastra";
import { InMemoryStore } from "@mastra/core/storage";
import { serviceDeskMastraScorers } from "./serviceDeskScorers.js";
import { serviceDeskTools } from "./serviceDeskTools.js";
import { serviceDeskWorkflows } from "./serviceDeskWorkflow.js";
import { mastraAgents } from "./ticketAgent.js";

export const mastra = new Mastra({
  agents: mastraAgents,
  tools: serviceDeskTools,
  workflows: serviceDeskWorkflows,
  scorers: serviceDeskMastraScorers,
  server: {
    cors: {
      origin: ["http://127.0.0.1:3001", "http://localhost:3001"],
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
