# Ticket Workspace View Extraction - PRD

## Problem

`frontend/src/App.tsx` still owns the complete ticket treatment workspace. Even after extracting support panels, the central app file keeps a large UI surface with local form state, permissions, ticket context, timeline composition, task handling, resolution controls and assistant chat wiring. This makes future operational UI improvements slower and raises regression risk because unrelated app-shell changes must parse the full workspace implementation.

## Goal

Move `TicketWorkspaceView` into a dedicated ticket view module while preserving the current workflow, permissions, visual hierarchy and E2E behavior.

## Users

- Analysts and managers working tickets.
- Requesters reading public followups.
- Developers maintaining ticket workflows and AI governance surfaces.

## Requirements

- `App.tsx` MUST keep orchestration, data loading, mutations and route state.
- `TicketWorkspaceView` MUST live under `frontend/src/views/tickets`.
- The extracted view MUST preserve existing props and behavior.
- Lazy ticket chat loading MUST remain scoped to the ticket workspace.
- The UI MUST remain a product interface: dense, predictable, keyboard-friendly and free of decorative redesign.

## Non-Goals

- No visual redesign.
- No API behavior changes.
- No new ticket workflow capability.
- No broad component-system rewrite.

## Success Metrics

- `App.tsx` loses the workspace implementation block and related imports.
- Frontend lint, build and E2E pass.
- Compozy task metadata validates.

