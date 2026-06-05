# AI Decision Feedback Loop TechSpec

## Executive Summary

The implementation adds ticket-local AI feedback as a new domain field under `ticket.ai.feedback`. A new authenticated ticket route records feedback through `AgentOrchestrator`, preserving existing permission checks and repository update patterns.

The primary trade-off is keeping feedback embedded in ticket records for fast delivery instead of creating a separate feedback subsystem. This is sufficient for Phase 1 and can be aggregated later.

## System Architecture

### Component Overview

- `backend/src/domain/ticket.ts`: adds `TicketAiFeedback` and request schema.
- `backend/src/ai/agents/AgentOrchestrator.ts`: adds `recordAiFeedback`.
- `backend/src/http/routes/tickets.ts`: adds `POST /api/tickets/:id/ai-feedback`.
- `frontend/src/lib/api.ts`: adds feedback types and API client.
- `frontend/src/App.tsx`: wires feedback mutation into `TicketWorkspaceView`.
- `frontend/src/styles.css`: styles compact feedback controls.
- Tests cover backend permission and frontend smoke behavior.

## Implementation Design

### Core Interfaces

```ts
export type TicketAiFeedback = {
  id: string;
  decision: "triage" | "resolution_draft";
  rating: "useful" | "needs_review" | "incorrect";
  note?: string;
  actorId: string;
  actorName: string;
  createdAt: string;
};
```

### Data Models

- `Ticket.ai.feedback` is optional for backward compatibility.
- Feedback entries append only; no update/delete in Phase 1.
- Repositories store feedback as part of the ticket object without schema migration for memory mode.

### API Endpoints

- `POST /api/tickets/:id/ai-feedback`
  - Request: `{ decision, rating, note? }`
  - Response: updated `Ticket`
  - `400`: invalid request
  - `404`: ticket missing, not in scope, or actor cannot work ticket

## Integration Points

No external services are added.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|----------------------|-----------------|
| Ticket domain | modified | Adds optional feedback field | Keep backward compatible |
| Ticket API | modified | Adds mutation route | Use existing auth patterns |
| Workspace UI | modified | Adds feedback controls | Keep compact and non-blocking |
| Tests | modified | Adds backend and e2e coverage | Verify permission behavior |

## Testing Approach

### Unit Tests

- TypeScript compile validates shared ticket shape.
- Backend tests validate route schema and permission behavior.

### Integration Tests

- API integration creates a ticket, blocks requester feedback, records admin feedback, and verifies audit entry.
- Playwright admin smoke verifies feedback controls are visible and can submit.

## Development Sequencing

### Build Order

1. Add domain and frontend types - no dependencies.
2. Add orchestrator mutation and HTTP route - depends on step 1.
3. Add frontend API client and workspace UI - depends on steps 1 and 2.
4. Add tests and styles - depends on steps 2 and 3.
5. Run verification and update tracking - depends on all previous steps.

### Technical Dependencies

- Existing ticket authorization helpers.
- Existing ticket repository update behavior.
- Existing workspace mutation flow.

## Monitoring and Observability

- Each feedback submission adds a ticket audit entry.
- Future cycles can aggregate `ticket.ai.feedback` in the governance dashboard.

## Technical Considerations

### Key Decisions

- Decision: append feedback to the ticket.
- Rationale: keeps context, actor, and existing persistence together.
- Trade-offs: no cross-ticket analytics in Phase 1.
- Alternatives rejected: separate repository, free-form follow-up only.

### Known Risks

- Redis records with older tickets may not have `ai.feedback`. Mitigation: treat the field as optional and default to an empty array.

## Architecture Decision Records

- [ADR-001: Store AI decision feedback on the ticket](adrs/adr-001.md) - Use ticket-local feedback before adding a global feedback repository.
