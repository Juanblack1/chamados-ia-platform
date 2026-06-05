---
status: completed
title: Add backend AI feedback mutation
type: backend
complexity: medium
dependencies: []
---

# Task 1: Add backend AI feedback mutation

## Overview

Add ticket-local AI feedback storage and a scoped API route. This makes human review outcomes queryable without creating a new persistence subsystem.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details - do not duplicate here
- FOCUS ON "WHAT" - describe what needs to be accomplished, not how
- MINIMIZE CODE - show code only to illustrate current structure or problem areas
- TESTS REQUIRED - every task MUST include tests in deliverables
</critical>

<requirements>
- Ticket domain MUST include optional AI feedback entries.
- Backend MUST expose a scoped ticket feedback route.
- Only workers authorized for the ticket MUST be allowed to record feedback.
- Feedback MUST append and create an audit entry.
</requirements>

## Subtasks

- [x] 1.1 Add domain types and schema.
- [x] 1.2 Add orchestrator method.
- [x] 1.3 Add HTTP route.
- [x] 1.4 Add API integration coverage.

## Implementation Details

Modify `backend/src/domain/ticket.ts`, `backend/src/ai/agents/AgentOrchestrator.ts`, `backend/src/http/routes/tickets.ts`, and `backend/tests/api.integration.test.ts`.

### Relevant Files

- `backend/src/domain/ticket.ts` - ticket type and schemas.
- `backend/src/ai/agents/AgentOrchestrator.ts` - ticket mutation patterns.
- `backend/src/http/routes/tickets.ts` - route registration.

### Dependent Files

- `frontend/src/lib/api.ts` - mirrors new feedback type.

### Related ADRs

- [ADR-001: Store AI decision feedback on the ticket](adrs/adr-001.md) - Defines ticket-local feedback storage.

## Deliverables

- Backend route for AI feedback.
- Ticket-local feedback persistence.
- Backend integration tests.
- Test coverage target >=80%.

## Tests

- Unit tests:
  - [x] TypeScript validates ticket feedback shape.
- Integration tests:
  - [x] Requester feedback on worker-only route returns 404.
  - [x] Admin feedback appends entry and audit event.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Feedback is stored on the ticket and audit trail.
