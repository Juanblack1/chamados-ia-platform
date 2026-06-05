# Ticket Workspace Panels Extraction TechSpec

## Executive Summary

Create `frontend/src/views/tickets/TicketWorkspacePanels.tsx` and move support panel components plus private helpers from `App.tsx`. `TicketWorkspaceView` continues to compose the same JSX through imports.

## Scope

- Add `TicketWorkspacePanels.tsx`.
- Export `TicketAssistantChatFallback`, `AiFeedbackPanel`, `AiTraceabilityPanel`, `ApprovalPanel`, `AgentRail`, `buildTimelineEvents` and `localizeTimelineMessage`.
- Keep helper label/formatting functions private.
- Remove moved code and unused imports from `App.tsx`.

## System Design

`App.tsx` retains the workspace container and mutation wiring. The new module owns presentation-only panels:

```ts
export function AiFeedbackPanel(...)
export function ApprovalPanel(...)
export function AgentRail(...)
```

Timeline helpers are exported because `TicketWorkspaceView` still builds timeline events before rendering.

## Testing Strategy

- Run frontend lint.
- Run frontend build.
- Run E2E.
- Validate task metadata.

## Development Sequencing

1. Move support panel code into a ticket module.
2. Export panel components and timeline helpers.
3. Update `App.tsx` imports.
4. Clean unused root imports.
5. Verify and update tracking.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Extract cohesive workspace panels before moving the whole workspace.
