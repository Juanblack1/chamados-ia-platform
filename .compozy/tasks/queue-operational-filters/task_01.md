---
status: completed
title: Add queue filter state and predicates
type: frontend
complexity: low
dependencies: []
---

# Task 1: Add queue filter state and predicates

## Requirements

- App MUST track priority, SLA risk, and AI confidence filters.
- Filters MUST combine with existing status and search filters.
- Dashboard queue shortcuts MUST reset unrelated filters.

## Subtasks

- [x] 1.1 Add filter types.
- [x] 1.2 Add state and reset helper.
- [x] 1.3 Extend `visibleTickets`.

## Tests

- [x] Frontend TypeScript validates filter predicates.
