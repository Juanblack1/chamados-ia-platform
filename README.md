# AI Service Desk

Corporate service desk demo with AI-assisted ticket intake, multi-agent triage, RAG evidence, audit trail, and deployment scaffolding.

## Stack

- Node.js, TypeScript, Fastify
- Mastra-ready agent definition
- LangChain prompt layer
- Google AI Studio through Vercel AI SDK (`@ai-sdk/google` + `ai`)
- Qdrant vector search
- React, Vite, CopilotKit runtime/tool calls
- Docker, Kubernetes manifests, Azure DevOps pipeline

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Backend: `http://localhost:4000`

Frontend: `http://localhost:5173`

The backend has deterministic fallback responses when no AI key is configured, so tests and the local demo run without external credentials. For Google AI Studio, put `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`; that file is gitignored. The frontend never receives this key.

## API

- `GET /health`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/:id`
- `GET /api/agents/runs`
- `GET /api/agents/traces`
- `POST /api/agents/triage-preview`
- `GET|POST /api/copilotkit/*`

## Agent flow

`AgentOrchestrator` creates a trace per ticket, retrieves RAG context from Qdrant, runs the triage and resolution agents, stores evidence/confidence on the ticket, and emits audit events. CopilotKit is backed by a Google model through the Vercel AI SDK and exposes server-side tools to list tickets, preview triage, and create a ticket.

## Deployment

`vercel.json` deploys the Vite frontend plus a serverless Fastify API adapter under `/api`. By default it runs without the Google secret, using deterministic fallback. `docker-compose.yml` runs backend, frontend, and Qdrant. Kubernetes manifests expect `ai-service-desk-secrets` to be created by the Azure DevOps pipeline from secret variables `GOOGLE_GENERATIVE_AI_API_KEY` and `API_KEYS`; no production secret is stored in the repository.

## Stitch

Generated screens are tracked under `.stitch/designs` and `.stitch/metadata.json`.
