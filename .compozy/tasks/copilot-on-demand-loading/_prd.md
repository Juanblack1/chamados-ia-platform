# Copilot On-Demand Loading PRD

## Overview

The authenticated workspace currently mounts `CopilotKit` around the full app. Even though the popup is lazy, the Copilot provider loads as part of the initial authenticated render. Build output shows large Copilot-related chunks, so the service desk should defer that cost until the operator explicitly opens the Copilot.

## Goals

- Keep the main service-desk workspace independent from Copilot bundle loading.
- Load Copilot runtime UI only after the user clicks the Copilot button.
- Preserve the current popup behavior and runtime URL.
- Keep the ticket workspace `assistant-ui` chat unchanged.

## User Stories

- As an analyst, I want the workspace to render without waiting for optional Copilot UI.
- As an operator, I want the Copilot button to open the same assistant when I choose to use it.
- As a maintainer, I want optional AI UI dependencies isolated from the app shell.

## Core Features

- Extract Copilot provider and popup into a lazy component.
- Mount the lazy component only when `copilotLaunchKey > 0`.
- Add a compact loading state for the Copilot surface.
- Remove now-unused whole-workspace Suspense fallback.

## Non-Goals

- No backend Copilot runtime changes.
- No assistant-ui ticket chat changes.
- No dependency lockfile cleanup in this cycle.
- No visual redesign of the Copilot popup.

## Success Metrics

- `App.tsx` no longer wraps the whole workspace in `CopilotKit`.
- Copilot code is behind an on-demand lazy boundary.
- Frontend lint, build, E2E, and Compozy validation pass.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Load optional Copilot UI only on demand.
