# App Shell Dead Queue Cleanup PRD

## Overview

The active queue route uses the modular `frontend/src/views/tickets/QueueView.tsx`, but `App.tsx` still contains an older queue implementation. This creates a maintenance hazard because future developers can patch the wrong queue view and believe they changed production behavior.

## Goals

- Remove obsolete queue code from `App.tsx`.
- Reduce duplicate UI logic for queue metrics, tables, and SLA badges.
- Keep runtime behavior unchanged.
- Preserve all active components still used by other views.

## User Stories

- As a developer, I want only one queue implementation so future queue changes land in the active component.
- As a product owner, I want lower regression risk for queue improvements.
- As a reviewer, I want the app shell to contain orchestration code rather than stale view copies.

## Core Features

- Delete the dead `QueueView` function from `App.tsx`.
- Delete the dead local `MetricStrip` function from `App.tsx`.
- Delete the dead local `TicketTable` function from `App.tsx`.
- Verify imports and active route behavior.

## Non-Goals

- No broader App shell refactor.
- No movement of remaining large detail/intake components in this cycle.
- No behavior or CSS redesign.

## Success Metrics

- `App.tsx` no longer defines a local `QueueView`.
- Queue route still renders through `TicketQueueView`.
- Frontend lint, build, E2E, and Compozy validation pass.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Remove the stale queue implementation from the app shell.
