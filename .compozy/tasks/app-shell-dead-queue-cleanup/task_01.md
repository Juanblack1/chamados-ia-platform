---
status: completed
title: Remove stale queue implementation
type: frontend
complexity: low
dependencies: []
---

# Task 1: Remove stale queue implementation

## Requirements

- `App.tsx` MUST not define a local `QueueView`.
- Dead local `MetricStrip` and `TicketTable` helpers MUST be removed with it.
- Shared helpers used elsewhere MUST remain untouched.

## Subtasks

- [x] 1.1 Delete local `QueueView`.
- [x] 1.2 Delete local `MetricStrip`.
- [x] 1.3 Delete local `TicketTable`.
- [x] 1.4 Confirm no dead queue symbol remains.

## Tests

- [x] TypeScript lint passes.
