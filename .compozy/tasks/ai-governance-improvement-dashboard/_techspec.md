# AI Governance Improvement Dashboard TechSpec

## Executive Summary

The implementation adds a React view that aggregates existing tickets, trace spans, and agent audit entries into an AI governance dashboard. The primary technical trade-off is keeping recommendation logic client-side for speed of delivery while accepting that future large-queue deployments may need server-side aggregation.

The backend already exposes `/api/agents/traces` and `/api/agents/runs`. The frontend will add typed access for audit runs, refresh them with the existing workspace load, and render deterministic governance recommendations without new packages or persistence.

## System Architecture

### Component Overview

- `frontend/src/lib/api.ts`: adds the `AgentAuditEntry` type and `listAgentRuns()` API client.
- `frontend/src/views/agents/GovernanceView.tsx`: new presentational and aggregation component for AI governance.
- `frontend/src/App.tsx`: stores audit runs, loads them during workspace refresh, adds navigation, and passes authorized tickets/traces/runs into the view.
- `frontend/src/styles.css`: adds responsive styles for the governance dashboard.
- `frontend/e2e/service-desk.spec.ts`: extends the admin smoke test to verify the new screen and mobile layout.

## Implementation Design

### Core Interfaces

```ts
export type AgentAuditEntry = {
  id: string;
  eventType: string;
  message: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type GovernanceRecommendation = {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  evidence: string;
  action: string;
};
```

### Data Models

- Tickets remain the source for SLA, approval, AI confidence, RAG coverage, and direct navigation.
- Trace spans remain the source for agent execution health, errors, and duration.
- Audit entries remain the source for recent domain and agent activity.
- Recommendation cards are derived view models and are not persisted in Phase 1.

### API Endpoints

- `GET /api/agents/runs`: returns recent agent/domain audit events. The existing route is reused.
- `GET /api/agents/traces`: returns recent trace spans. The existing route is reused.
- `GET /api/tickets`: returns the current user's authorized queue. The existing route is reused.

## Integration Points

No external integrations are added. The feature uses existing same-origin authenticated API calls.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|----------------------|-----------------|
| Frontend API client | modified | Adds typed audit fetcher; low risk | Add type and function |
| App shell | modified | Adds state, route, and navigation item; medium risk | Keep view gated to non-requesters |
| Governance view | new | New aggregation UI; medium risk | Keep pure and deterministic |
| CSS | modified | Adds dashboard styles; low risk | Scope selectors to governance classes |
| E2E test | modified | Adds coverage for navigation and responsive layout; low risk | Extend admin test |

## Testing Approach

### Unit Tests

- TypeScript build verifies the view model and API contracts.
- Pure recommendation logic stays inside the component but uses deterministic data paths and no side effects.

### Integration Tests

- Playwright admin flow opens the governance screen and validates key headings.
- Mobile viewport check confirms no document-level horizontal overflow.
- Backend integration tests remain unchanged because backend routes already exist.

## Development Sequencing

### Build Order

1. Add frontend API types and audit fetcher - no dependencies.
2. Add the governance view - depends on step 1.
3. Wire navigation and workspace refresh - depends on steps 1 and 2.
4. Add styles and e2e coverage - depends on steps 2 and 3.
5. Run verification and update task status - depends on steps 1 through 4.

### Technical Dependencies

- Existing `/api/agents/runs`, `/api/agents/traces`, and `/api/tickets` routes.
- Existing authenticated admin or analyst demo users.

## Monitoring and Observability

- The view displays trace error counts, average duration, recent spans, and recent audit entries.
- No new logging is required in Phase 1.
- Future server-side aggregation should log recommendation generation counts and stale-data age.

## Technical Considerations

### Key Decisions

- Decision: compute recommendations in the frontend.
- Rationale: all required data is already loaded by the app shell, and Phase 1 should validate usefulness before persistence.
- Trade-offs: repeated computation on render, no historical recommendation state.
- Alternatives rejected: backend recommendation service, per-ticket-only UI.

### Known Risks

- Large ticket lists could make client-side aggregation expensive. Mitigation: Phase 1 uses current demo-scale data; Phase 2 can move aggregation server-side.
- Agent audit payload shape is broad. Mitigation: display stable top-level fields and avoid relying on nested payload details.

## Architecture Decision Records

- [ADR-001: Surface AI governance as an operator dashboard](adrs/adr-001.md) - Reuse current ticket, audit, and trace data in a frontend governance surface before adding backend persistence.
