# Tasks: Service Desk Improvements

Date: 2026-06-01

## Batch 1

- [x] Remove production exposure of the demo requester login from the frontend bundle.
- [x] Keep demo login available only when explicitly enabled for development/demo environments.
- [x] Standardize intake fallback text and missing-information prompts in pt-BR.
- [x] Filter weak or unrelated RAG sources before using them in intake scoring, self-service, and UI output.
- [x] Correct the intake assessment workflow labels so assessment does not imply a ticket was opened.
- [x] Add visible feedback when image attachments are rejected because of type, size, or limit.
- [x] Lazy-load Copilot UI chrome so the main app shell is not forced into the first bundle.
- [x] Verify with lint, backend tests, and production build.

## Later Batches

- [x] Replace base64 image persistence with authenticated object storage and malware scanning.
- [x] Split `frontend/src/App.tsx` into route-level views, ticket modules, admin modules, and shared components.
- [x] Add API integration tests for auth, RBAC, ticket creation, blocked intake, and status transitions.
- [x] Add browser E2E coverage for login, opening a ticket, blocked intake, and requester-only queue scope.
- [x] Add scoped manager access by entity/group instead of global manager visibility.
- [x] Add category-specific opening templates for ERP, identity, network, APIs, hardware, and approvals.
