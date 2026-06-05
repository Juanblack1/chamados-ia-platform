---
status: completed
title: Add workload aggregation model
type: frontend
complexity: low
dependencies: []
---

# Task 1: Add workload aggregation model

## Requirements

- Queue MUST aggregate active workload by assigned group.
- Queue MUST aggregate active workload by assignee.
- Workload MUST exclude resolved and closed tickets.

## Subtasks

- [x] 1.1 Add workload row types.
- [x] 1.2 Compute group rows from `allTickets`.
- [x] 1.3 Compute assignee rows from `allTickets`.

## Tests

- [x] Frontend lint validates model code.
