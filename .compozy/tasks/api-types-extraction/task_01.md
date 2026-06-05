---
status: completed
title: Extract API type contracts
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Extract API type contracts

## Requirements

- API/domain type declarations MUST move to `apiTypes.ts`.
- `api.ts` MUST reexport the same public types.
- Runtime request functions MUST remain in `api.ts`.

## Subtasks

- [x] 1.1 Create `frontend/src/lib/apiTypes.ts`.
- [x] 1.2 Move exported type declarations from `api.ts`.
- [x] 1.3 Import required types back into `api.ts` with `import type`.
- [x] 1.4 Reexport public types from `api.ts`.
- [x] 1.5 Confirm line-count reduction.

## Tests

- [x] Frontend lint passes.

## Evidence

- `frontend/src/lib/api.ts` reduced from 519 lines to 215 lines.
- `npm.cmd --workspace frontend run lint` passed.
