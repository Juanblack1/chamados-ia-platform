# Copilot UI Dependency Cleanup PRD

## Overview

The frontend imports Copilot v2 components from `@copilotkit/react-core/v2`, but still declares a direct dependency on `@copilotkit/react-ui`. Local package documentation identifies `react-ui` as a v1 package for this use case. Keeping it as an app dependency increases install surface and creates ambiguity about the supported Copilot API.

## Goals

- Remove the unused direct `@copilotkit/react-ui` dependency.
- Keep the lazy Copilot popup behavior unchanged.
- Keep package manifests and lockfile consistent.

## User Stories

- As a maintainer, I want frontend dependencies to match actual imports.
- As a developer, I want Copilot usage to point clearly at the v2 React Core API.
- As an operator, I want no behavior regression in the on-demand Copilot popup.

## Core Features

- Remove `@copilotkit/react-ui` from frontend dependencies.
- Preserve `@copilotkit/react-core` and the existing `@copilotkit/react-core/v2` imports.
- Verify no source import references `@copilotkit/react-ui`.

## Non-Goals

- No Copilot runtime API changes.
- No popup UI redesign.
- No dependency version upgrades beyond lockfile normalization from npm.

## Success Metrics

- `frontend/package.json` no longer declares `@copilotkit/react-ui`.
- Source search finds no `@copilotkit/react-ui` imports.
- Frontend lint, build and E2E pass.
- Compozy task validation passes.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Prefer Copilot v2 exports from React Core.
