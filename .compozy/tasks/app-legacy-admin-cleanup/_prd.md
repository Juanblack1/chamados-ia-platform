# App Legacy Admin Cleanup PRD

## Overview

`frontend/src/App.tsx` still contains legacy user/admin views and helper components that are no longer routed after the dedicated user administration flow was introduced. It also defines local `SlaBadge`, `SkeletonRows` and file-reading helpers that already exist or are unused elsewhere.

## Goals

- Remove dead legacy admin/user components from `App.tsx`.
- Reuse the shared `SlaBadge` component instead of a local duplicate.
- Reduce `App.tsx` size without changing active user workflows.

## User Stories

- As a maintainer, I want `App.tsx` to contain only active orchestration and screen code.
- As a developer, I want SLA badge behavior to come from one shared component.
- As an operator, I want no regression in ticket workspace or user administration flows.

## Core Features

- Delete unreferenced `UsersView`, `AdminView`, `UserEditorRow`, `SkeletonRows` and `readFileAsDataUrl`.
- Import `SlaBadge` from shared common components.
- Remove imports that become unused after cleanup.

## Non-Goals

- No active user-management extraction in this cycle.
- No visual redesign.
- No backend changes.

## Success Metrics

- `App.tsx` line count decreases.
- Searches show the removed legacy component names no longer exist in `App.tsx`.
- Frontend lint, build and E2E pass.
- Compozy task validation passes.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Remove inactive App-local admin surfaces before larger extraction.
