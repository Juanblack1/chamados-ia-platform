# Admin Access Controls Duplicate Cleanup PRD

## Overview

`App.tsx` still defines local access-control checkbox components while the active admin forms already use the extracted `views/admin/AccessControls` components. Keeping both implementations increases maintenance risk because future permission or group behavior can be patched in the wrong place.

## Goals

- Remove dead local `GroupCheckboxes` from `App.tsx`.
- Remove dead local `PermissionCheckboxes` from `App.tsx`.
- Keep the extracted admin access-control components as the single implementation.
- Preserve current user creation and editing behavior.

## User Stories

- As a developer, I want permission and group controls to have one source of truth.
- As an admin, I want user creation and editing controls to behave consistently.
- As a reviewer, I want dead app-shell UI code removed before more admin features are added.

## Core Features

- Delete unused local access-control component definitions.
- Confirm active admin forms still reference `AdminGroupCheckboxes` and `AdminPermissionCheckboxes`.
- Run frontend verification after cleanup.

## Non-Goals

- No redesign of admin forms.
- No permission model changes.
- No extraction of unrelated app-shell components.

## Success Metrics

- `App.tsx` no longer defines local `GroupCheckboxes` or `PermissionCheckboxes`.
- Admin access controls continue to compile through the extracted component imports.
- Frontend lint, build, E2E, and Compozy validation pass.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Keep admin access controls as extracted shared components.
