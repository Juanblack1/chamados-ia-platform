---
status: completed
title: Create shared agent eval report runner
type: backend
complexity: medium
dependencies: []
---

# Task 1: Create shared agent eval report runner

## Requirements

- Eval cases MUST move into a reusable source module.
- The runner MUST execute in an isolated in-memory orchestrator.
- The runner MUST return a serializable report with case and scorer detail.
- The backend MUST expose `GET /api/agents/evals`.

## Subtasks

- [x] 1.1 Create the shared eval suite module.
- [x] 1.2 Refactor the existing eval test to use the shared runner.
- [x] 1.3 Register the eval report endpoint.
- [x] 1.4 Add backend integration assertions.

## Tests

- [x] Backend eval suite still passes.
- [x] API integration test verifies `GET /api/agents/evals`.
