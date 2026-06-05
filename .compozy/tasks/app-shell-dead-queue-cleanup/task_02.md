---
status: completed
title: Verify active queue route
type: test
complexity: low
dependencies:
  - task_01
---

# Task 2: Verify active queue route

## Requirements

- Queue route MUST still render via the modular `TicketQueueView`.
- Existing E2E workflow MUST pass.
- Build warnings MUST not become build failures.

## Subtasks

- [x] 2.1 Run frontend lint.
- [x] 2.2 Run frontend build.
- [x] 2.3 Run E2E.
- [x] 2.4 Validate Compozy task metadata.
- [x] 2.5 Update tracking.

## Tests

- [x] Frontend lint passes.
- [x] Frontend build passes.
- [x] Playwright E2E passes.
- [x] Compozy task validation passes.
