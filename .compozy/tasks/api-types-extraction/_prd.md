# API Types Extraction - PRD

## Problem

`frontend/src/lib/api.ts` mixes domain contracts with HTTP request functions. It is the largest frontend source file and every small API-client change requires scanning a long type block first.

## Goal

Extract API/domain type contracts into a dedicated module while preserving the current public import path for the rest of the frontend.

## Users

- Developers maintaining service-desk API calls.
- Developers adding ticket, governance or user-management screens.

## Requirements

- Domain and payload types MUST move to `frontend/src/lib/apiTypes.ts`.
- `frontend/src/lib/api.ts` MUST keep exporting the same types so existing imports remain valid.
- Runtime API behavior MUST stay unchanged.
- The extraction MUST not require edits across every consumer.

## Non-Goals

- No backend endpoint changes.
- No request/response shape changes.
- No visual or UX changes.

## Success Metrics

- `api.ts` line count is materially reduced.
- Existing imports from `lib/api` continue to typecheck.
- Frontend lint, build and E2E pass.
- Compozy task metadata validates.
