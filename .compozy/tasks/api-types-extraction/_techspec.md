# API Types Extraction - TechSpec

## Current State

`frontend/src/lib/api.ts` currently contains:

- exported domain types for users, tickets, AI feedback, traces and eval reports;
- exported request/payload types;
- API request functions;
- `request<T>()` HTTP helper.

## Proposed Design

Create `frontend/src/lib/apiTypes.ts` and move all exported type declarations there. `api.ts` will import only the types it needs internally and reexport all public contracts from `apiTypes.ts`.

This keeps call sites such as `import type { Ticket } from "../../lib/api"` working while making the runtime API client easier to read.

## Implementation Notes

- Move only `export type` declarations.
- Keep `API_BASE_URL`, request functions and `request<T>()` in `api.ts`.
- Use `import type` in `api.ts` to avoid runtime imports.
- Add `export type { ... } from "./apiTypes";` to preserve the existing module contract.

## Risk

- Missing a moved type in the reexport list can break consumer imports.
- Accidentally moving runtime constants into `apiTypes.ts` would create avoidable coupling.

## Verification

- `npm.cmd --workspace frontend run lint`
- `npm.cmd --workspace frontend run build`
- `npm.cmd run test:e2e`
- `compozy.cmd tasks validate --name api-types-extraction`
