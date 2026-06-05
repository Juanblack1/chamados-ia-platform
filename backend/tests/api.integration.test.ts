import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../src/config/env.js";
import { buildServer } from "../src/http/server.js";

const imageDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("service desk API", () => {
  it("bootstraps only the admin account in production", async () => {
    app = await buildServer({ ...makeEnv(), NODE_ENV: "production" });

    const adminCookie = await loginAs("admin@empresa.local", "admin123");
    const response = await app.inject({ method: "GET", url: "/api/users", headers: { cookie: adminCookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json().users).toEqual([
      expect.objectContaining({
        email: "admin@empresa.local",
        role: "admin",
        permissions: expect.arrayContaining(["tickets.open", "tickets.read", "tickets.work", "tickets.delete", "users.manage"])
      })
    ]);
  });

  it("requires auth, blocks vague intake, opens a ticket and serves stored attachments only to the requester", async () => {
    app = await buildServer(makeEnv());

    const unauthenticated = await app.inject({ method: "GET", url: "/api/tickets" });
    expect(unauthenticated.statusCode).toBe(401);

    const requesterCookie = await loginAs("solicitante.teste@empresa.local", "dev123");
    const blocked = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: requesterCookie },
      payload: {
        requesterEmail: "alguem@empresa.local",
        department: "Operacoes",
        title: "Problema urgente",
        description: "Nao funciona direito desde ontem e preciso de ajuda.",
        affectedService: "Geral",
        urgency: "medium",
        impact: "medium",
        businessImpact: "Nao sei.",
        attachments: []
      }
    });
    expect(blocked.statusCode).toBe(422);
    expect(blocked.json().error).toBe("intake_not_ready");

    const created = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: requesterCookie },
      payload: buildTicketPayload({
        requesterEmail: "outra.pessoa@empresa.local",
        title: "Faturamento bloqueado no ERP",
        attachments: [imageDataUrl]
      })
    });

    expect(created.statusCode).toBe(201);
    const ticket = created.json();
    expect(ticket.requesterEmail).toBe("solicitante.teste@empresa.local");
    expect(ticket.attachments[0]).toMatch(new RegExp(`^/api/tickets/${ticket.id}/attachments/`));
    expect(ticket.attachments[0]).not.toContain("base64");

    const listed = await app.inject({ method: "GET", url: "/api/tickets", headers: { cookie: requesterCookie } });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().map((item: { id: string }) => item.id)).toContain(ticket.id);

    const attachment = await app.inject({ method: "GET", url: ticket.attachments[0], headers: { cookie: requesterCookie } });
    expect(attachment.statusCode).toBe(200);
    expect(attachment.headers["content-type"]).toContain("image/png");

    const otherRequesterCookie = await loginAs("solicitante@empresa.local", "dev123");
    const forbiddenAttachment = await app.inject({
      method: "GET",
      url: ticket.attachments[0],
      headers: { cookie: otherRequesterCookie }
    });
    expect(forbiddenAttachment.statusCode).toBe(404);
  });

  it("scopes managers to their entity and assigned groups for queue and status changes", async () => {
    app = await buildServer(makeEnv());
    const adminCookie = await loginAs("admin@empresa.local", "admin123");

    const manager = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { cookie: adminCookie },
      payload: {
        email: "gestor.erp@empresa.local",
        name: "Gestor ERP",
        role: "manager",
        entityId: "corp",
        entityName: "Corporativo",
        groupIds: ["grp-erp"],
        password: "gestor123"
      }
    });
    expect(manager.statusCode).toBe(201);

    const erpTicket = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: adminCookie },
      payload: buildTicketPayload({ title: "Falha fiscal ERP SP", affectedService: "ERP Central" })
    });
    const networkTicket = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: adminCookie },
      payload: buildTicketPayload({
        title: "VPN instavel para equipe externa",
        affectedService: "Rede Corporativa",
        description: "VPN desconecta a cada dez minutos para a equipe externa desde 08:30 com erro de tunel.",
        businessImpact: "Equipe externa nao consegue atender clientes em campo."
      })
    });
    expect(erpTicket.statusCode).toBe(201);
    expect(networkTicket.statusCode).toBe(201);

    const managerCookie = await loginAs("gestor.erp@empresa.local", "gestor123");
    const queue = await app.inject({ method: "GET", url: "/api/tickets", headers: { cookie: managerCookie } });
    expect(queue.statusCode).toBe(200);
    const titles = queue.json().map((ticket: { title: string }) => ticket.title);
    expect(titles).toContain("Falha fiscal ERP SP");
    expect(titles).not.toContain("VPN instavel para equipe externa");

    const statusChange = await app.inject({
      method: "POST",
      url: `/api/tickets/${erpTicket.json().id}/status`,
      headers: { cookie: managerCookie },
      payload: { status: "in_progress" }
    });
    expect(statusChange.statusCode).toBe(200);
    expect(statusChange.json().status).toBe("in_progress");

    const targetedAssignment = await app.inject({
      method: "POST",
      url: `/api/tickets/${erpTicket.json().id}/assign`,
      headers: { cookie: adminCookie },
      payload: { assigneeId: "usr-tech-erp" }
    });
    expect(targetedAssignment.statusCode).toBe(200);
    expect(targetedAssignment.json()).toEqual(
      expect.objectContaining({
        assigneeId: "usr-tech-erp",
        assigneeName: "Rafael Torres"
      })
    );

    const invalidAssignment = await app.inject({
      method: "POST",
      url: `/api/tickets/${erpTicket.json().id}/assign`,
      headers: { cookie: adminCookie },
      payload: { assigneeId: "usr-tech-network" }
    });
    expect(invalidAssignment.statusCode).toBe(404);

    const outOfScopeChange = await app.inject({
      method: "POST",
      url: `/api/tickets/${networkTicket.json().id}/status`,
      headers: { cookie: managerCookie },
      payload: { status: "in_progress" }
    });
    expect(outOfScopeChange.statusCode).toBe(404);
  });

  it("requires worker approval before resolving a ticket with pending human review", async () => {
    app = await buildServer(makeEnv());
    const adminCookie = await loginAs("admin@empresa.local", "admin123");

    const created = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: adminCookie },
      payload: buildTicketPayload({
        title: "Faturamento parado para filial SP",
        description: "O lote fiscal do ERP falhou desde 09:00 com erro FIS-103 e a filial SP esta sem faturar.",
        businessImpact: "Fechamento fiscal parado, clientes sem notas e risco de compliance."
      })
    });
    expect(created.statusCode).toBe(201);
    const ticket = created.json();
    expect(ticket.approvals).toEqual([
      expect.objectContaining({
        status: "requested",
        requesterId: "sla-risk"
      })
    ]);

    const blockedResolution = await app.inject({
      method: "POST",
      url: `/api/tickets/${ticket.id}/resolve`,
      headers: { cookie: adminCookie },
      payload: { message: "Solucao validada e comunicada ao solicitante." }
    });
    expect(blockedResolution.statusCode).toBe(404);

    const requesterCookie = await loginAs("solicitante.teste@empresa.local", "dev123");
    const requesterDecision = await app.inject({
      method: "POST",
      url: `/api/tickets/${ticket.id}/approval`,
      headers: { cookie: requesterCookie },
      payload: { decision: "approved" }
    });
    expect(requesterDecision.statusCode).toBe(404);

    const approved = await app.inject({
      method: "POST",
      url: `/api/tickets/${ticket.id}/approval`,
      headers: { cookie: adminCookie },
      payload: { decision: "approved", note: "Risco revisado pelo N2." }
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().approvals[0]).toEqual(
      expect.objectContaining({
        status: "approved",
        decidedById: "usr-admin",
        decidedByName: "Administrador Service Desk",
        decisionNote: "Risco revisado pelo N2."
      })
    );

    const resolved = await app.inject({
      method: "POST",
      url: `/api/tickets/${ticket.id}/resolve`,
      headers: { cookie: adminCookie },
      payload: { message: "Solucao validada e comunicada ao solicitante." }
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().status).toBe("resolved");
  });

  it("records worker feedback for an AI decision", async () => {
    app = await buildServer(makeEnv());
    const adminCookie = await loginAs("admin@empresa.local", "admin123");

    const created = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: adminCookie },
      payload: buildTicketPayload({
        title: "VPN instavel para diretoria",
        affectedService: "Rede Corporativa",
        description: "VPN desconecta a cada dez minutos para diretoria desde 08:30 com erro de tunel no cliente.",
        businessImpact: "Diretoria nao consegue acessar paineis comerciais antes da reuniao executiva."
      })
    });
    expect(created.statusCode).toBe(201);
    const ticket = created.json();

    const requesterCookie = await loginAs("solicitante.teste@empresa.local", "dev123");
    const denied = await app.inject({
      method: "POST",
      url: `/api/tickets/${ticket.id}/ai-feedback`,
      headers: { cookie: requesterCookie },
      payload: { decision: "triage", rating: "incorrect" }
    });
    expect(denied.statusCode).toBe(404);

    const feedback = await app.inject({
      method: "POST",
      url: `/api/tickets/${ticket.id}/ai-feedback`,
      headers: { cookie: adminCookie },
      payload: { decision: "triage", rating: "needs_review", note: "Prioridade deveria considerar diretoria." }
    });
    expect(feedback.statusCode).toBe(200);
    expect(feedback.json().ai.feedback).toEqual([
      expect.objectContaining({
        decision: "triage",
        rating: "needs_review",
        note: "Prioridade deveria considerar diretoria.",
        actorId: "usr-admin",
        actorName: "Administrador Service Desk"
      })
    ]);
    expect(feedback.json().audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "ai.feedback_recorded",
          message: expect.stringContaining("feedback para revisao")
        })
      ])
    );
  });

  it("keeps retrieved RAG evidence aligned with the service desk catalog", async () => {
    app = await buildServer(makeEnv());
    const adminCookie = await loginAs("admin@empresa.local", "admin123");

    const created = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: adminCookie },
      payload: buildTicketPayload({
        title: "Faturamento ERP bloqueado no fechamento fiscal",
        affectedService: "ERP Central"
      })
    });
    expect(created.statusCode).toBe(201);
    const ticket = created.json();
    expect(ticket.ai.triage.metadata).toEqual(
      expect.objectContaining({
        traceId: expect.any(String),
        modelRoute: "local-fallback",
        executionMode: "deterministic-fallback"
      })
    );
    expect(ticket.ai.resolutionDraft.metadata).toEqual(
      expect.objectContaining({
        traceId: ticket.ai.triage.metadata.traceId,
        modelRoute: "local-fallback",
        executionMode: "deterministic-fallback"
      })
    );

    const catalog = await app.inject({
      method: "GET",
      url: "/api/catalog/service-desk",
      headers: { cookie: adminCookie }
    });
    expect(catalog.statusCode).toBe(200);

    const articleIds = new Set(catalog.json().knowledgeArticles.map((article: { id: string }) => article.id));
    const sourceIds = ticket.ai.retrievedSources.map((source: { id: string }) => source.id);

    expect(sourceIds.length).toBeGreaterThan(0);
    expect(sourceIds.every((sourceId: string) => articleIds.has(sourceId))).toBe(true);
    expect(catalog.json().knowledgeArticles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "kb-priority-sla",
          ownerGroupId: "grp-approvals",
          reviewCadenceDays: 30,
          status: "needs_review"
        })
      ])
    );
  });

  it("exposes a deterministic agent eval report", async () => {
    app = await buildServer(makeEnv());
    const adminCookie = await loginAs("admin@empresa.local", "admin123");

    const response = await app.inject({
      method: "GET",
      url: "/api/agents/evals",
      headers: { cookie: adminCookie }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        suiteId: "service-desk-agent-baseline",
        score: 100,
        passRate: 100,
        totalCases: 3,
        passedCases: 3,
        failedCases: 0,
        modelRoute: "local-fallback",
        executionMode: "deterministic-fallback"
      })
    );
    expect(response.json().cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "erp-critical-approval",
          passed: true,
          sourceIds: expect.arrayContaining(["kb-erp-billing-lock"]),
          expectedSpans: expect.arrayContaining(["agent.rag-retrieval", "agent.ticket-triage"])
        })
      ])
    );
    expect(response.json().scorers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rag-grounding",
          passRate: 100
        })
      ])
    );
  });
});

async function loginAs(email: string, password: string): Promise<string> {
  if (!app) throw new Error("Server not initialized.");
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password }
  });
  expect(response.statusCode).toBe(200);
  const setCookie = response.headers["set-cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  expect(cookie).toBeTruthy();
  return String(cookie).split(";")[0];
}

function buildTicketPayload(overrides: Record<string, unknown> = {}) {
  return {
    requesterEmail: "ana@acme.local",
    department: "Financeiro",
    title: "Faturamento bloqueado no ERP",
    description: "O lote de faturamento do ERP falhou e o fechamento fiscal da filial esta bloqueado desde 09:00.",
    affectedService: "ERP Central",
    urgency: "critical",
    impact: "critical",
    businessImpact: "Fechamento mensal parado para a filial SP.",
    attachments: [],
    ...overrides
  };
}

function makeEnv(): AppEnv {
  return {
    NODE_ENV: "development",
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
    AUTH_BOOTSTRAP_ADMIN_PASSWORD: "admin123",
    AUTH_TEST_REQUESTER_EMAIL: "solicitante.teste@empresa.local",
    AUTH_TEST_REQUESTER_PASSWORD: "dev123",
    TICKET_STORAGE: "memory",
    TICKET_REDIS_PREFIX: "ai-service-desk-api-test",
    TICKET_SEED_SAMPLE_DATA: false,
    KV_REST_API_URL: "",
    KV_REST_API_TOKEN: "",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    QDRANT_URL: "http://localhost:6333",
    QDRANT_API_KEY: "",
    QDRANT_COLLECTION: "service_desk_knowledge_api_test"
  };
}
