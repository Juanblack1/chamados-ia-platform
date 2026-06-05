# Queue Workload Balancing TechSpec

## Executive Summary

Add a read-only workload panel to `frontend/src/views/tickets/QueueView.tsx`. It computes active workload from the already scoped ticket array, then renders group and assignee summaries with compact, responsive CSS.

## Scope

- Compute active tickets in `QueueView`.
- Aggregate by assigned group and assignee.
- Render workload rows between the metric strip and queue table.
- Add responsive CSS for desktop and mobile.
- Extend Playwright coverage.

## System Design

The implementation remains client-side because the application already loads tickets scoped by the authenticated user and uses client-side queue filtering. The panel uses `allTickets`, not `tickets`, so managers see total authorized workload while table filters remain independent.

Active tickets are tickets whose status is not `resolved` or `closed`.

Group summary fields:

- `active`: total active tickets in group.
- `critical`: active critical tickets.
- `slaAttention`: active tickets where `slaRisk(ticket) !== "ok"`.
- `lowConfidence`: active tickets with triage confidence below `0.72`.
- `unassigned`: active tickets without `assigneeId`.

Assignee summary fields:

- `active`: active assigned tickets.
- `critical`: active critical tickets.
- `slaAttention`: active SLA warning or breached tickets.

## Frontend Design

Add a `.workload-panel` using the existing `.panel` base. It has:

- A heading with total groups represented.
- A left section for group load.
- A right section for assignee load.
- Dense row metadata using existing badge tones.

No cards inside cards; rows are flat list items inside the panel.

## Testing Strategy

- Frontend lint for TypeScript and React.
- Frontend build for bundling.
- Playwright verifies the workload panel appears in the admin queue and includes group/assignee labels.
- Mobile no-horizontal-overflow assertion remains in place.

## Development Sequencing

1. Add workload aggregation helpers in `QueueView`.
2. Render workload panel and empty states.
3. Add CSS for desktop and mobile.
4. Extend E2E coverage.
5. Run verification and mark tasks complete.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Add a client-side workload panel to the queue.
