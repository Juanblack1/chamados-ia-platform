# Ticket Workspace View Extraction - TechSpec

## Current State

`App.tsx` renders `TicketWorkspaceView` inline and imports many icons, ticket helpers and workspace panel helpers only for that view. The view already depends on extracted panel components from `TicketWorkspacePanels.tsx`.

## Proposed Design

Create `frontend/src/views/tickets/TicketWorkspaceView.tsx` and move the whole view component there. The new module will:

- import React hooks and `Suspense`;
- lazy-load `TicketAssistantChat`;
- import ticket panel components and timeline helpers from `TicketWorkspacePanels.tsx`;
- import presentation helpers from `lib/presentation`;
- keep a small local assignability helper if no other module needs it.

`App.tsx` will import `TicketWorkspaceView` and pass the same props it already provides.

## Boundaries

- App-level state, mutations and selected-ticket routing stay in `App.tsx`.
- Workspace-local input state stays inside `TicketWorkspaceView`.
- Shared panel behavior stays in `TicketWorkspacePanels.tsx`.

## Risk

- Import cleanup can accidentally remove symbols still used by login or app shell.
- Moving lazy chat loading can change chunk boundaries, so build output must be checked.
- E2E must confirm the treatment workspace still opens responsively.

## Verification

- `npm.cmd --workspace frontend run lint`
- `npm.cmd --workspace frontend run build`
- `npm.cmd run test:e2e`
- `compozy.cmd tasks validate --name ticket-workspace-view-extraction`

