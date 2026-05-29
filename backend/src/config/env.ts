import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

for (const file of ["../.env", ".env", "../.env.local", ".env.local"]) {
  loadDotenv({ path: resolve(process.cwd(), file), override: file.endsWith(".local") });
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info"),
  API_KEYS: z.string().default(""),
  AI_PROVIDER: z.enum(["google", "mock"]).default("google"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().default(""),
  GOOGLE_GENERATIVE_AI_MODEL: z.string().default("gemini-2.5-flash"),
  GOOGLE_GENERATIVE_AI_FALLBACK_MODELS: z.string().default("gemini-2.5-flash-lite,gemini-2.0-flash"),
  GOOGLE_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(64),
  AUTH_COOKIE_NAME: z.string().min(1).default("asid"),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 8),
  AUTH_BOOTSTRAP_ADMIN_EMAIL: z.string().email().default("admin@empresa.local"),
  AUTH_BOOTSTRAP_ADMIN_PASSWORD: z.string().default(""),
  AUTH_TEST_REQUESTER_EMAIL: z.string().email().default("solicitante.teste@empresa.local"),
  AUTH_TEST_REQUESTER_PASSWORD: z.string().default(""),
  TICKET_STORAGE: z.enum(["auto", "memory", "redis"]).default("auto"),
  TICKET_REDIS_PREFIX: z.string().min(1).default("ai-service-desk"),
  TICKET_SEED_SAMPLE_DATA: z.coerce.boolean().default(false),
  KV_REST_API_URL: z.string().default(""),
  KV_REST_API_TOKEN: z.string().default(""),
  UPSTASH_REDIS_REST_URL: z.string().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(""),
  QDRANT_URL: z.string().url().default("http://localhost:6333"),
  QDRANT_API_KEY: z.string().default(""),
  QDRANT_COLLECTION: z.string().default("service_desk_knowledge")
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${issues.join("\n")}`);
  }

  return parsed.data;
}

export function parseApiKeys(env: AppEnv): Set<string> {
  return new Set(
    env.API_KEYS.split(",")
      .map((key) => key.trim())
      .filter(Boolean)
  );
}
