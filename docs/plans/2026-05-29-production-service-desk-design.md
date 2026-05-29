# Production Service Desk Design

## Goal

Evolve the current AI ticketing demo into a production-shaped service desk application. The product should feel closer to a real ITIL help desk: authenticated users, role-based access, operational queues, ticket lifecycle actions, SLA visibility, auditability, and AI assistance that supports analysts instead of replacing workflow controls.

## Reference Model

The product borrows service desk concepts from GLPI without cloning its full scope:

- Profiles and permissions are central to access control.
- Users work inside scoped roles such as requester, technician, supervisor, and admin.
- Tickets carry type, urgency, impact, calculated priority, assigned group, assignee, SLA and status.
- Ticket detail is organized around follow-ups, tasks, solution, approval, knowledge, history, and statistics.
- SLA tracking includes ownership and resolution deadlines, with escalation risk visible in the queue.

## Product Surfaces

### Login

The first screen is an authentication form. It uses an HttpOnly session cookie and never exposes backend secrets to the browser. The user sees only recovery-oriented errors such as invalid credentials or expired session.

### Requester Portal

Requester users can open new tickets and see only their own tickets. The opening form separates incident/request, service, urgency, impact, description, and attachments. AI can suggest category, priority, group, and response, but ticket creation remains explicit.

### Analyst Console

Technician and supervisor users land on a work queue. The queue supports scanning by SLA risk, priority, status, assigned group, assignee, requester, service, and AI confidence. Row actions must work, including open detail, assign to me, change status, and refresh.

### Ticket Workspace

The ticket detail screen is the center of work. It includes:

- Header with status, priority, SLA clocks, assigned group, assignee, and safe actions.
- Conversation/follow-up timeline.
- Internal tasks with completion state.
- AI panel with agents, tool calls, RAG evidence, confidence, trace id, and audit trail.
- Resolution proposal with human approval.
- Context panel for requester, department, service, category, impact, attachments, and tags.

### Administration

Admin users can inspect users, roles, groups, SLA policies, and knowledge base entries. This first version can be a functional management surface backed by seeded production data, not a full directory integration.

## Backend Architecture

### Auth

Add an auth module with:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Sessions are stored server-side and referenced by a signed random token in an HttpOnly cookie. Redis is used in production; memory is used only for local/test fallback.

### RBAC

Roles:

- `admin`: users, groups, SLA, all tickets.
- `supervisor`: all tickets, assignment, escalation, reports.
- `technician`: assigned group tickets and own tickets.
- `requester`: create tickets and read own tickets.

All ticket reads and mutations go through the current session user. API-key access remains useful for server-to-server calls but must not be the browser's primary production access pattern.

### Ticket Workflow

Extend ticket data with:

- `type`: incident or request.
- `entity`, `requestSource`, `impact`, `urgency`, `priority`.
- `assignedGroupId`, `assigneeId`, `slaPolicyId`, `sla`.
- `followups`, `tasks`, `approvals`.
- `audit`.

Add mutation endpoints for assign, status transition, follow-up, task, and resolution. The orchestrator continues to run RAG, triage, and draft generation during creation.

### AI Agents

Make the agents explicit in the UI and API:

- Intake classifier: normalizes category, impact, urgency, and type.
- Routing agent: suggests group and assignee.
- RAG agent: retrieves knowledge articles and runbooks.
- Resolution agent: drafts a response or solution.
- SLA risk agent: flags escalation risk.

Tool calls should be visible as audit entries. Destructive or externally visible changes require human action.

## UI Direction

Register: product.

Scene sentence: A support analyst works from a dense browser tab during business hours, scanning SLA risk and AI suggestions while keeping control over assignments and customer-facing responses.

Design dials:

- Visual variance: 5
- Motion intensity: 3
- Information density: 8

Use a restrained enterprise layout: persistent sidebar, dense table, focused detail workspace, inline banners, clear focus states, and no marketing hero composition. Buttons use verb-object labels and every visible button must call a real handler.

## Verification

Required before publishing:

- Backend tests and TypeScript compile.
- Frontend TypeScript build.
- Manual smoke tests for login, ticket list, create ticket, assign ticket, add follow-up, add task, resolve ticket, logout.
- Production health and authenticated API smoke after deploy.
