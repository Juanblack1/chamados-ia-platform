# App Shell Legacy View Cleanup PRD

## Overview

`App.tsx` still contains legacy local implementations for intake and detail screens even though the active routes use modular views. This increases maintenance cost and makes it easy to patch dead UI.

## Goals

- Remove unused local `IntakeView`.
- Remove unused local `IntakeIntelligencePanel`.
- Remove unused local `DetailView`.
- Preserve active workspace helpers and modular route behavior.

## User Stories

- As a developer, I want the app shell to contain routing and orchestration rather than stale screen copies.
- As a reviewer, I want future intake/detail changes to land in active components.
- As a product owner, I want lower regression risk as more operational features are added.

## Core Features

- Delete legacy local intake block.
- Delete legacy local detail block.
- Confirm modular route imports remain in use.
- Remove imports that become unused after deletion.

## Non-Goals

- No extraction of the active `TicketWorkspaceView` in this cycle.
- No behavior changes.
- No CSS redesign.

## Success Metrics

- `App.tsx` no longer defines local `IntakeView`, `IntakeIntelligencePanel`, or `DetailView`.
- Frontend lint, build, E2E, and Compozy validation pass.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Keep app shell focused by deleting legacy local views.
