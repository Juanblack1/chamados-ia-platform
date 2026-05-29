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
  GOOGLE_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(64),
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
