# App Shell Dead Queue Cleanup TechSpec

## Executive Summary

Remove the obsolete queue view implementation embedded in `App.tsx`. The live route already imports `QueueView as TicketQueueView` from `frontend/src/views/tickets/QueueView.tsx`, so this cleanup is a narrow deletion with verification.

## Scope

- Remove `function QueueView` from `App.tsx`.
- Remove its local helper functions `MetricStrip` and `TicketTable`.
- Keep shared local functions that are still referenced elsewhere, such as `SlaBadge` and `SkeletonRows`.
- Run frontend verification and E2E.

## System Design

No architecture change is introduced. The app already has this structure:

```tsx
import { QueueView as TicketQueueView } from "./views/tickets/QueueView";
```

The cleanup simply removes unreachable definitions below `Topbar`.

## Testing Strategy

- TypeScript lint must prove no removed symbol is referenced.
- Build must prove bundling still succeeds.
- E2E must prove the queue and treatment workflows still render.

## Development Sequencing

1. Delete the stale queue block.
2. Run `rg` to confirm `function QueueView` is gone from `App.tsx`.
3. Run lint/build/E2E.
4. Mark tracking complete and validate tasks.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Remove the stale queue implementation from the app shell.
