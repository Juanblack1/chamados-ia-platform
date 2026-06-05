# App State Screens Extraction - PRD

## Problem

`App.tsx` still contains boot, login and Copilot loading screens. These UI states are not part of app orchestration, but they keep icons, form fields, test-login constants and local login state inside the root component file.

## Goal

Move app state screens into a dedicated component module while preserving login behavior, test-login support and loading visuals.

## Users

- Requesters, analysts and admins using login and app boot states.
- Developers maintaining app shell and authentication flow.

## Requirements

- `BootScreen`, `CopilotLoadingFallback` and `LoginScreen` MUST move out of `App.tsx`.
- Login behavior, validation and test-login autofill MUST stay unchanged.
- `App.tsx` MUST keep auth orchestration and pass callbacks to the login screen.
- UI copy and styling MUST remain unchanged.

## Non-Goals

- No auth API changes.
- No visual redesign.
- No theme storage rewrite.

## Success Metrics

- `App.tsx` imports fewer login/loading-specific icons and helpers.
- Frontend lint, build and E2E pass.
- Compozy task metadata validates.

