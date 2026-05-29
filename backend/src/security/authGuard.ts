import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppEnv } from "../config/env.js";
import { parseApiKeys } from "../config/env.js";
import type { AppUser, AuthStore } from "./authStore.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AppUser;
  }
}

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export function registerAccessGuard(app: FastifyInstance, env: AppEnv, auth: AuthStore): void {
  const apiKeys = parseApiKeys(env);

  app.addHook("preHandler", async (request, reply) => {
    if (request.method === "OPTIONS" || isPublicRoute(request)) return;
    if (env.NODE_ENV === "test") return;

    const apiKey = readHeaderValue(request.headers["x-api-key"]);
    if (apiKey && apiKeys.has(apiKey)) {
      request.currentUser = {
        id: "system-api",
        email: "system@service-desk.local",
        name: "System API",
        role: "admin",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-erp", "grp-network", "grp-iam", "grp-platform"],
        active: true
      };
      return;
    }

    const token = readCookie(request.headers.cookie, env.AUTH_COOKIE_NAME);
    const user = token ? await auth.findSessionUser(token) : undefined;
    if (user) {
      request.currentUser = user;
      return;
    }

    return reply.code(401).send({
      error: "unauthorized",
      message: "Sua sessao expirou. Entre novamente para continuar."
    });
  });
}

export function requireUser(request: FastifyRequest): AppUser {
  if (!request.currentUser) throw new Error("Authenticated user was not attached to the request.");
  return request.currentUser;
}

export function buildSessionCookie(env: AppEnv, token: string, expiresAt: string): string {
  return [
    `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
    env.NODE_ENV === "production" ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildExpiredSessionCookie(env: AppEnv): string {
  return [
    `${env.AUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    env.NODE_ENV === "production" ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  return header
    .split(";")
    .map((part) => part.trim())
    .map((part) => {
      const separator = part.indexOf("=");
      return separator === -1 ? [part, ""] : [part.slice(0, separator), part.slice(separator + 1)];
    })
    .find(([key]) => key === name)?.[1];
}

function isPublicRoute(request: FastifyRequest): boolean {
  const url = request.url.split("?")[0];
  return url === "/health" || url === "/api/health" || url === "/api/auth/login" || url === "/api/auth/logout";
}

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
