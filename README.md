# AI Service Desk

Corporate service desk demo with AI-assisted ticket intake, multi-agent triage, RAG evidence, audit trail, and deployment scaffolding.

## Stack

- Node.js, TypeScript, Fastify
- Mastra agent registry for intake quality, triage, RAG, routing, resolution draft, SLA risk, and ticket specialist agents
- LangChain prompt layer
- Google AI Studio through Vercel AI SDK (`@ai-sdk/google` + `ai`)
- Qdrant vector search
- React, Vite, CopilotKit runtime/tool calls
- Upstash/Vercel KV-compatible Redis ticket persistence
- Docker, Kubernetes manifests, Azure DevOps pipeline

## Product surface

- Session login with HttpOnly cookies, bootstrap admin, role-aware access, and API-key support for server-to-server automation.
- Requester portal for opening incidents and requests with image attachments.
- Analyst queue with filters, SLA, priority, group routing, and AI/RAG evidence.
- Ticket workspace with assign-to-me, status transitions, public/internal follow-ups, tasks, task completion, resolution, timeline, audit trail, and streaming assistant chat.
- Profile editing for the logged user and admin user management with roles, groups, activation, and password reset.
- Admin/catalog view for users, groups, SLA policies, and knowledge articles.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Backend: `http://localhost:4000`

Frontend: `http://localhost:5173`

The Vite dev server proxies same-origin `/api` calls to `VITE_DEV_API_TARGET` (`http://localhost:4000` by default). Keep API and CopilotKit same-origin unless you explicitly handle cross-origin auth; the app uses HttpOnly cookies.

Local development creates deterministic demo users in memory:

- `admin@empresa.local` / `admin123`
- `supervisor@empresa.local` / `dev123`
- `tecnico.erp@empresa.local` / `dev123`
- `tecnico.rede@empresa.local` / `dev123`
- `solicitante@empresa.local` / `dev123`
- `solicitante.teste@empresa.local` / `dev123`

These fallback passwords are disabled in `NODE_ENV=production`; production requires `AUTH_BOOTSTRAP_ADMIN_PASSWORD`. A production requester test account can be enabled with `AUTH_TEST_REQUESTER_EMAIL` and `AUTH_TEST_REQUESTER_PASSWORD`.

Production test requester on Vercel:

- `solicitante.teste@empresa.local` / `ChamadosTeste@2026!`

The backend has deterministic fallback responses when no AI key is configured, so tests and the local demo run without external credentials. For Google AI Studio, put `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`; that file is gitignored. The frontend never receives this key.
Text generation uses a model cascade: `GOOGLE_GENERATIVE_AI_MODEL` first, then comma-separated `GOOGLE_GENERATIVE_AI_FALLBACK_MODELS` for rate-limit/provider failures, then a deterministic local fallback.

Ticket persistence uses memory by default in local/test runs. In production, set `TICKET_STORAGE=redis` plus either `KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`. `TICKET_SEED_SAMPLE_DATA` defaults to `false`, so production starts without demo tickets.

## API

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PATCH /api/users/me`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `GET /api/tickets`
- `POST /api/tickets/intake-assessment`
- `POST /api/tickets`
- `GET /api/tickets/:id`
- `POST /api/tickets/:id/assign`
- `POST /api/tickets/:id/status`
- `POST /api/tickets/:id/followups`
- `POST /api/tickets/:id/tasks`
- `POST /api/tickets/:id/tasks/:taskId/complete`
- `POST /api/tickets/:id/resolve`
- `POST /api/tickets/:id/chat`
- `POST /api/tickets/:id/chat/stream`
- `DELETE /api/tickets/:id`
- `GET /api/catalog/service-desk`
- `GET /api/agents/runs`
- `GET /api/agents/traces`
- `GET /api/agents/config`
- `POST /api/agents/triage-preview`
- `GET|POST /api/copilotkit` and `/api/copilotkit/*`

## Agent flow

`AgentOrchestrator` first runs an intelligent intake assessment to block vague or self-service-only requests before persistence. When the ticket is allowed, it creates a trace per ticket, runs RAG retrieval against Qdrant, then executes the triage, routing, SLA-risk, and resolution-draft workflow stages. Each stage stores evidence, decisions, confidence, traces, and agent memory on the ticket, then emits audit events. Mastra agents are registered in `backend/src/ai/mastra/ticketAgent.ts`. The ticket workspace also includes a `ticket-specialist` Mastra agent exposed through an assistant-ui chat; it streams status/model/delta events over SSE, answers with the active ticket, all user-authorized tickets, RAG evidence, trace context, and persisted agent memory.

CopilotKit is backed by a Google model through the Vercel AI SDK and exposes server-side tools to describe the AI architecture, search RAG knowledge, list tickets, assess intake quality, preview triage, and create a ticket. The create-ticket tool runs `assess_ticket_intake` first and returns missing questions or self-service guidance instead of creating low-quality tickets.

## Image attachments

Use the image drop area in "Abrir chamado" or the upload button in the Copilot chat. The API accepts up to 4 image URLs or image data URLs per ticket. Binary image data is stored on the ticket for the demo UI, but agent prompts receive only an attachment summary so base64 is not sent to the LLM.

## Deployment

`vercel.json` deploys the Vite frontend plus a serverless Fastify API adapter under `/api`. By default it runs without the Google secret, using deterministic fallback. For production persistence, connect Upstash for Redis from the Vercel Marketplace and set `TICKET_STORAGE=redis`.

Required production secrets:

- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `AUTH_TEST_REQUESTER_PASSWORD`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Optional production settings:

- `AUTH_BOOTSTRAP_ADMIN_EMAIL`
- `AUTH_TEST_REQUESTER_EMAIL`
- `AUTH_SESSION_TTL_SECONDS`
- `API_KEYS`
- `TICKET_REDIS_PREFIX`
- `GOOGLE_GENERATIVE_AI_FALLBACK_MODELS`

`docker-compose.yml` runs backend, frontend, and Qdrant. Kubernetes manifests expect `ai-service-desk-secrets` to be created by the Azure DevOps pipeline from secret variables `GOOGLE_GENERATIVE_AI_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `AUTH_BOOTSTRAP_ADMIN_PASSWORD`, and `API_KEYS`; no production secret is stored in the repository.

## Stitch

Generated screens are tracked under `.stitch/designs` and `.stitch/metadata.json`.
