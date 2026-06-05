// Suite: service desk agent evals
// Invariant: agent workflows must produce expected intake outcomes, grounded sources, approval gates, and trace spans for curated service desk cases.
// Boundary IN: AgentOrchestrator, deterministic model fallback, RAG fallback, eval scorers.
// Boundary OUT: browser UI and external model providers, covered by e2e and provider configuration.
import { describe, expect, it } from "vitest";
import { runServiceDeskEvalSuite, serviceDeskEvalCases } from "../src/ai/evals/serviceDeskEvalSuite.js";
import type { AppEnv } from "../src/config/env.js";

describe("service desk agent evals", () => {
  it.each(serviceDeskEvalCases)("$name", async (testCase) => {
    const report = await runServiceDeskEvalSuite(makeEnv(), { cases: [testCase] });
    const result = report.cases[0];

    expect(result, result.scorers.map((scorer) => `${scorer.id}: ${scorer.reason}`).join("\n")).toEqual(
      expect.objectContaining({
        passed: true,
        score: 100
      })
    );
  });
});

function makeEnv(): AppEnv {
  return {
    NODE_ENV: "test",
    PORT: 4000,
    FRONTEND_ORIGIN: "http://localhost:5173",
    LOG_LEVEL: "silent",
    API_KEYS: "",
    AI_PROVIDER: "mock",
    GOOGLE_GENERATIVE_AI_API_KEY: "",
    GOOGLE_GENERATIVE_AI_MODEL: "gemini-2.5-flash",
    GOOGLE_GENERATIVE_AI_FALLBACK_MODELS: "gemini-2.5-flash-lite,gemini-2.0-flash",
    GOOGLE_EMBEDDING_MODEL: "gemini-embedding-001",
    XAI_API_KEY: "",
    XAI_MODEL_CASCADE: "grok-4-1-fast-non-reasoning,grok-4-fast-non-reasoning,grok-3-mini,grok-3",
    EMBEDDING_DIMENSION: 64,
    AUTH_COOKIE_NAME: "asid",
    AUTH_SESSION_TTL_SECONDS: 28800,
    AUTH_BOOTSTRAP_ADMIN_EMAIL: "admin@empresa.local",
    AUTH_BOOTSTRAP_ADMIN_PASSWORD: "",
    AUTH_TEST_REQUESTER_EMAIL: "solicitante.teste@empresa.local",
    AUTH_TEST_REQUESTER_PASSWORD: "",
    TICKET_STORAGE: "memory",
    TICKET_REDIS_PREFIX: "ai-service-desk-eval-test",
    TICKET_SEED_SAMPLE_DATA: false,
    KV_REST_API_URL: "",
    KV_REST_API_TOKEN: "",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    QDRANT_URL: "http://localhost:6333",
    QDRANT_API_KEY: "",
    QDRANT_COLLECTION: "service_desk_knowledge_eval_test"
  };
}
