---
status: completed
title: Remove unused Copilot UI dependency
type: frontend
complexity: low
dependencies: []
---

# Task 1: Remove unused Copilot UI dependency

## Requirements

- `frontend/package.json` MUST NOT declare `@copilotkit/react-ui`.
- `@copilotkit/react-core` MUST remain declared.
- Existing `@copilotkit/react-core/v2` imports MUST remain unchanged.

## Subtasks

- [x] 1.1 Remove `@copilotkit/react-ui` from the frontend workspace.
- [x] 1.2 Confirm `@copilotkit/react-core` remains declared.
- [x] 1.3 Confirm source imports do not reference `@copilotkit/react-ui`.

## Tests

- [x] Dependency search confirms no direct frontend reference.
