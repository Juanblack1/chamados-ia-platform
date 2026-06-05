# Queue Operational Filters TechSpec

## Executive Summary

Add client-side queue filters in the React app for priority, SLA risk, and AI confidence. The trade-off is speed of delivery versus server-side scalability; the MVP uses loaded tickets because the app already scopes data by authenticated user.

## Scope

- Add `priorityFilter`, `slaRiskFilter`, and `confidenceFilter` state in `App`.
- Extend `visibleTickets` filtering logic.
- Pass filter state and setters into `Topbar`.
- Render compact select controls for queue view only.
- Add E2E coverage.

## System Design

Filtering stays in the same `visibleTickets` memo that currently handles search and status. Each new filter uses stable existing helpers and ticket fields:

- `priorityFilter`: compares `ticket.priority`.
- `slaRiskFilter`: compares `slaRisk(ticket)`.
- `confidenceFilter`: treats confidence below `0.72` as low.

Dashboard shortcuts reset operational filters to avoid surprising carry-over.

## Core Interfaces

```ts
type SlaRiskFilter = "all" | "breached" | "warning" | "ok";
type AiConfidenceFilter = "all" | "low" | "normal";
```

## Frontend Design

The queue topbar will show three additional selects after the status filter:

- "Todas prioridades"
- "Todo SLA"
- "Toda confianca IA"

The controls use the existing `.select-filter` vocabulary with icons from lucide-react.

## Testing Strategy

- TypeScript validates filter state and predicate logic.
- Build validates JSX and CSS.
- Playwright verifies critical priority filtering, low-confidence filtering, and mobile no-overflow.

## Development Sequencing

1. Add filter types, state, reset helper, and predicate logic.
2. Extend `Topbar` props and queue controls. Depends on step 1.
3. Extend E2E queue flow. Depends on step 2.
4. Run verification and update tracking. Depends on steps 1 through 3.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Add client-side operational queue filters.
