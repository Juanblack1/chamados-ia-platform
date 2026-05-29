# AI Service Desk Design

## Product cut

Build a technical demo for opening and managing support tickets with AI assistance. The first version shows a credible backend architecture and a working product UI without mentioning any job post.

## Architecture

The system is a small monorepo:

- `backend`: Fastify API, domain events, audit log, API-key guard, multi-agent orchestration, Google/Vercel AI SDK model gateway, Qdrant-backed RAG service, and Mastra-compatible agent definition.
- `frontend`: React/Vite operational UI with ticket queue, AI-assisted intake, agent activity, and CopilotKit packages wired for a runtime endpoint.
- `infra`: Docker Compose, Kubernetes manifests, and Azure DevOps pipeline.
- `.stitch`: Stitch design system metadata and exported screen assets.

## AI flow

1. User submits a ticket description.
2. Knowledge agent retrieves source documents from Qdrant, with in-memory fallback for local demo.
3. Triage agent classifies category, priority, SLA, tags, and confidence.
4. Resolution agent drafts the first response and cites retrieved sources.
5. Orchestrator records audit events, trace spans, and AI decisions on the ticket.

## UI surfaces

- Operational queue dashboard.
- AI-assisted ticket intake.
- Ticket detail workspace with multi-agent timeline, RAG evidence, and governance panel.

## Verification

The implementation should pass TypeScript build and backend tests before handoff. Visual verification should be done in the browser after the dev servers start.
