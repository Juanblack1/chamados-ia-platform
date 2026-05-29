import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../../config/env.js";
import type { AuthStore } from "../../security/authStore.js";
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  LoginInputSchema,
  readCookie,
  requireUser
} from "../../security/authGuard.js";

export async function registerAuthRoutes(app: FastifyInstance, env: AppEnv, auth: AuthStore): Promise<void> {
  app.post("/api/auth/login", async (request, reply) => {
    const parsed = LoginInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Informe e-mail e senha validos."
      });
    }

    const user = await auth.verifyCredentials(parsed.data.email, parsed.data.password);
    if (!user) {
      return reply.code(401).send({
        error: "invalid_credentials",
        message: "E-mail ou senha invalidos."
      });
    }

    const session = await auth.createSession(user.id);
    reply.header("set-cookie", buildSessionCookie(env, session.token, session.expiresAt));
    return { user, expiresAt: session.expiresAt };
  });

  app.get("/api/auth/me", async (request) => ({ user: requireUser(request) }));

  app.post("/api/auth/logout", async (request, reply) => {
    const token = readCookie(request.headers.cookie, env.AUTH_COOKIE_NAME);
    if (token) await auth.revokeSession(token);
    reply.header("set-cookie", buildExpiredSessionCookie(env));
    return { ok: true };
  });
}
