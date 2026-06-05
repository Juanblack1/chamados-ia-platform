# App Chrome Extraction PRD

## Overview

`App.tsx` still owns the full navigation sidebar and topbar UI in addition to session boot, data loading, ticket workspace, user admin and Copilot orchestration. Moving the chrome to a dedicated component module reduces app-shell coupling and makes future navigation/filter work safer.

## Goals

- Extract `Sidebar` and `Topbar` from `App.tsx`.
- Keep the existing navigation, filters, theme controls and Copilot launch button unchanged.
- Preserve the product UI vocabulary and responsive behavior.
- Make app-shell responsibilities clearer before larger workspace extractions.

## User Stories

- As a developer, I want navigation chrome to live outside the main app orchestrator.
- As an analyst, I want queue filters, theme controls and Copilot launch behavior to remain unchanged.
- As a reviewer, I want future topbar/sidebar changes isolated in a smaller file.

## Core Features

- Add a reusable `AppChrome` module exporting `Sidebar`, `Topbar` and related filter/theme types.
- Import those components into `App.tsx`.
- Remove the local chrome component definitions from `App.tsx`.
- Run frontend verification.

## Non-Goals

- No visual redesign.
- No route model changes.
- No extraction of `TicketWorkspaceView` in this cycle.
- No CSS class renaming.

## Success Metrics

- `App.tsx` no longer defines local `Sidebar` or `Topbar`.
- The extracted components compile against existing props and helpers.
- Frontend lint, build, E2E, and Compozy validation pass.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Keep app chrome in a dedicated component module.
