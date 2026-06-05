---
status: completed
title: Isolate Copilot lazy boundary
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Isolate Copilot lazy boundary

## Requirements

- `App.tsx` MUST NOT wrap the full workspace in `CopilotKit`.
- Copilot provider and popup MUST live in a lazy component.
- Copilot UI MUST mount only after the Copilot launch key is positive.
- The existing runtime URL, credentials and labels MUST remain.

## Subtasks

- [x] 1.1 Add `CopilotWorkspace` component.
- [x] 1.2 Refactor `App.tsx` to render the app shell outside Copilot.
- [x] 1.3 Add compact loading fallback styles.
- [x] 1.4 Remove unused full-workspace fallback.

## Tests

- [x] Frontend lint passes.
