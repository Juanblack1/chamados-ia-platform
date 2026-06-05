---
status: completed
title: Extract app state screens
type: frontend
complexity: low
dependencies: []
---

# Task 1: Extract app state screens

## Requirements

- App state screens MUST move to `components/AppStateScreens.tsx`.
- Login test autofill MUST keep the same environment behavior.
- `App.tsx` imports MUST be cleaned.

## Subtasks

- [x] 1.1 Create `AppStateScreens.tsx`.
- [x] 1.2 Move boot and Copilot fallback components.
- [x] 1.3 Move login screen and login-only constants.
- [x] 1.4 Import moved components in `App.tsx`.
- [x] 1.5 Clean unused imports.

## Tests

- [x] Frontend lint passes.
