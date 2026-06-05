---
status: completed
title: Add verification coverage and close tracking
type: test
complexity: low
dependencies:
  - task_01
  - task_02
---

# Task 3: Add verification coverage and close tracking

## Requirements

- E2E MUST verify governance shows feedback after a worker records feedback.
- Frontend lint, frontend build, E2E, and Compozy validation MUST pass before completion.
- Tracking MUST be updated only after fresh verification.

## Subtasks

- [x] 3.1 Extend Playwright governance flow.
- [x] 3.2 Run frontend lint and build.
- [x] 3.3 Run E2E.
- [x] 3.4 Validate task metadata.
- [x] 3.5 Update tracking after verification.

## Tests

- [x] Playwright governance smoke passes.
- [x] Compozy task validation passes.
