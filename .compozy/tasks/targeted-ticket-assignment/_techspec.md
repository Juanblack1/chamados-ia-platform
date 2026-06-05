# Targeted Ticket Assignment TechSpec

## Executive Summary

Wire the existing assignment endpoint to honor `assigneeId`, validate the selected technician in domain logic, and add a treatment-workspace selector backed by the existing service desk catalog.

## Scope

- Pass `AuthStore` into `registerTicketRoutes`.
- Resolve `assigneeId` in `/api/tickets/:id/assign`.
- Validate target users in `AgentOrchestrator.assignTicket`.
- Extend `assignTicket` frontend API helper.
- Pass `catalog` into `TicketWorkspaceView`.
- Render eligible technician selector and preserve "Atribuir para mim".
- Add backend integration and E2E coverage.

## Backend Design

Route flow:

1. Parse optional `assigneeId`.
2. Resolve target user with `auth.findUserById`.
3. Call `orchestrator.assignTicket(id, actor, assignee)`.
4. Return 404 when ticket or target assignment is invalid.

Orchestrator validation:

- Actor must be able to work the ticket.
- Target must have `tickets.work`.
- Target must be in the same entity as the ticket.
- If ticket has `assignedGroupId`, target must belong to that group.

## Frontend Design

`TicketWorkspaceView` receives `catalog` and computes eligible assignees:

- active users only.
- users with `tickets.work`.
- same entity as the ticket.
- group membership matching `ticket.assignedGroupId`, when present.

The header renders:

- status select.
- assignee select.
- self-assign button.
- delete button when allowed.

## Testing Strategy

- Backend integration verifies targeted assignment and invalid target rejection.
- Frontend lint/build validate API/UI types.
- Playwright assigns a seed ERP ticket to Rafael Torres and expects the technician label to update.

## Development Sequencing

1. Backend route and orchestrator validation.
2. Frontend API and workspace UI.
3. Backend integration test.
4. E2E assignment coverage.
5. Verification and tracking.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Validate targeted assignment in the orchestrator.
