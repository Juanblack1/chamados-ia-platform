# Ticket Workspace Panels Extraction PRD

## Overview

`App.tsx` still owns several ticket workspace support panels: assistant fallback, AI feedback, AI traceability, approval review, timeline localization and agent rail. These pieces are cohesive workspace UI and can move into a dedicated tickets view module.

## Goals

- Extract ticket workspace support panels from `App.tsx`.
- Keep `TicketWorkspaceView` behavior unchanged.
- Reduce root app complexity before any full workspace extraction.

## User Stories

- As a maintainer, I want AI governance panels near ticket workspace code.
- As a developer, I want `App.tsx` to be easier to scan and review.
- As an analyst, I want no change in feedback, approval, timeline or traceability behavior.

## Core Features

- Move `AiFeedbackPanel`, `AiTraceabilityPanel`, `ApprovalPanel`, `AgentRail` and assistant chat fallback.
- Move private helper functions used only by those panels.
- Import extracted panels into `App.tsx`.

## Non-Goals

- No full `TicketWorkspaceView` extraction in this cycle.
- No UI redesign.
- No API behavior changes.

## Success Metrics

- `App.tsx` line count decreases.
- Frontend lint, build and E2E pass.
- Compozy task validation passes.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Extract cohesive workspace panels before moving the whole workspace.
