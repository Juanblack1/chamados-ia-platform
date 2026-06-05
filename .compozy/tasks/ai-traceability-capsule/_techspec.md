# TechSpec: AI Traceability Capsule

## Backend

- Add small route helpers on `TicketTriageAgent` and `ResolutionDraftAgent`:
  - `modelRoute()`
  - `executionMode()`
- Store `modelRoute` and `executionMode` in `ticket.ai.triage.metadata` and `ticket.ai.resolutionDraft.metadata`.
- Add API integration coverage for trace id, model route, and execution mode metadata.

## Frontend

- Pass loaded `traces` into `TicketWorkspaceView`.
- Build a ticket traceability model from:
  - `ticket.ai.triage.metadata.traceId`
  - `ticket.ai.triage.metadata.modelRoute`
  - `ticket.ai.triage.metadata.executionMode`
  - `ticket.requestSource`
  - pending approvals
  - matching trace spans
- Render a compact "Rastreabilidade IA" panel in the insight column.
- Add scoped responsive CSS.
- Extend E2E to assert traceability panel visibility.

## Testing

- `npm --workspace backend run test`
- `npm --workspace frontend run lint`
- `npm --workspace frontend run build`
- `npm run test:e2e`
- `compozy tasks validate --name ai-traceability-capsule`
