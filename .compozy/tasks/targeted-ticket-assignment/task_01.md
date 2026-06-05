---
status: completed
title: Wire backend targeted assignment
type: backend
complexity: medium
dependencies: []
---

# Task 1: Wire backend targeted assignment

## Requirements

- Assignment endpoint MUST honor optional `assigneeId`.
- Target user MUST be active and resolved through `AuthStore`.
- Orchestrator MUST reject incompatible target users.

## Subtasks

- [x] 1.1 Pass auth store into ticket routes.
- [x] 1.2 Resolve `assigneeId` in route.
- [x] 1.3 Validate target assignment in orchestrator.

## Tests

- [x] Backend integration covers valid and invalid targeted assignment.
