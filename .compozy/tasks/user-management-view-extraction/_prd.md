# User Management View Extraction PRD

## Overview

`frontend/src/App.tsx` still owns the active profile and user-management screens. After previous cleanup, those screens form a cohesive block that can move into `frontend/src/views/admin`, leaving `App.tsx` focused on app orchestration and routing.

## Goals

- Extract active profile and user-management views into a dedicated admin view module.
- Preserve all current user administration workflows and visual structure.
- Reduce `App.tsx` line count and import surface.

## User Stories

- As a maintainer, I want user-management UI code near the admin views it belongs to.
- As a developer, I want `App.tsx` to orchestrate views without owning every form implementation.
- As an admin, I want the directory, create user, edit user and profile flows to behave exactly as before.

## Core Features

- Move `ProfileView`, `UserDirectoryView`, `UserCreatePage` and `UserDetailPage`.
- Keep supporting form/security/password helpers private to the new module.
- Update `App.tsx` imports to consume the extracted views.

## Non-Goals

- No form UX redesign.
- No permission model changes.
- No backend/API changes.

## Success Metrics

- `App.tsx` line count decreases materially.
- Active user-management routes still pass E2E.
- Frontend lint and build pass.
- Compozy task validation passes.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Keep App focused on orchestration, not admin form implementation.
