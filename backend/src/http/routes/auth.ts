import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { AppEnv } from "../../config/env.js";
import { hasPermission, permissionKeys, type AuthStore } from "../../security/authStore.js";
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  LoginInputSchema,
  readCookie,
  requireUser
} from "../../security/authGuard.js";

const UserRoleSchema = z.enum(["admin", "manager", "employee", "requester"]);
const PermissionSchema = z.enum(permissionKeys);

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(120),
  role: UserRoleSchema,
  entityId: z.string().trim().min(1).max(80).default("corp"),
  entityName: z.string().trim().min(2).max(120).default("Corporativo"),
  groupIds: z.array(z.string().trim().min(1)).default([]),
  permissions: z.array(PermissionSchema).optional(),
  active: z.boolean().default(true),
  password: z.string().min(8).max(120)
});

const UpdateUserSchema = CreateUserSchema.partial().extend({
  password: z.string().min(8).max(120).optional()
});

const UpdateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  entityName: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(8).max(120).optional()
});

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

  app.patch("/api/users/me", async (request, reply) => {
    const actor = requireUser(request);
    const parsed = UpdateProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const updated = await auth.updateUser(actor.id, {
      name: parsed.data.name,
      entityName: parsed.data.entityName,
      password: parsed.data.password
    });
    if (!updated) return reply.code(404).send({ error: "not_found", message: "Usuario nao encontrado." });
    return { user: updated };
  });

  app.get("/api/users", async (request, reply) => {
    const actor = requireUser(request);
    if (!hasPermission(actor, "users.manage")) return reply.code(403).send({ error: "forbidden", message: "Somente administradores podem listar usuarios." });
    return { users: await auth.listUsers() };
  });

  app.post("/api/users", async (request, reply) => {
    const actor = requireUser(request);
    if (!hasPermission(actor, "users.manage")) return reply.code(403).send({ error: "forbidden", message: "Somente administradores podem criar usuarios." });

    const parsed = CreateUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    try {
      const user = await auth.createUser(parsed.data);
      return reply.code(201).send({ user });
    } catch (cause) {
      return sendUserMutationError(reply, cause);
    }
  });

  app.patch<{ Params: { id: string } }>("/api/users/:id", async (request, reply) => {
    const actor = requireUser(request);
    if (!hasPermission(actor, "users.manage")) return reply.code(403).send({ error: "forbidden", message: "Somente administradores podem editar usuarios." });

    const parsed = UpdateUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });
    if (request.params.id === actor.id && parsed.data.active === false) {
      return reply.code(400).send({ error: "self_deactivation", message: "Nao e permitido desativar o proprio usuario administrador." });
    }

    try {
      const user = await auth.updateUser(request.params.id, parsed.data);
      if (!user) return reply.code(404).send({ error: "not_found", message: "Usuario nao encontrado." });
      return { user };
    } catch (cause) {
      return sendUserMutationError(reply, cause);
    }
  });
}

function sendUserMutationError(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  if (message === "email_already_exists") {
    return reply.code(409).send({ error: "email_already_exists", message: "Ja existe um usuario com este e-mail." });
  }
  return reply.code(500).send({ error: "user_mutation_failed", message: "Nao foi possivel salvar o usuario." });
}
