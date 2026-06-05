---
status: completed
title: Add workspace traceability capsule
type: frontend
complexity: medium
dependencies:
  - task_01
---

# Task 2: Add workspace traceability capsule

## Requirements

- Workspace MUST receive trace spans.
- Capsule MUST show trace id, model route, request scope, policy status, and recent spans.
- Capsule MUST be responsive and visually consistent with the product UI.

## Subtasks

- [x] 2.1 Pass traces into workspace.
- [x] 2.2 Build traceability model.
- [x] 2.3 Render capsule.
- [x] 2.4 Add scoped CSS.

## Tests

- [x] TypeScript validates traceability props and metadata parsing.
- [x] E2E verifies capsule visibility.
