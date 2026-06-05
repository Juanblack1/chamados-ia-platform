---
status: completed
title: Extract governance model helpers
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Extract governance model helpers

## Requirements

- Model helpers MUST move out of `GovernanceView.tsx`.
- `GovernanceView.tsx` MUST preserve current rendering behavior.
- Imports MUST be reduced to view-specific concerns.

## Subtasks

- [x] 1.1 Create `governanceModel.ts`.
- [x] 1.2 Move governance types and model builder.
- [x] 1.3 Move label, tone and date helpers.
- [x] 1.4 Update `GovernanceView.tsx` imports.
- [x] 1.5 Confirm line-count reduction.

## Tests

- [x] Frontend lint passes.
