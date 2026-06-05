# TechSpec: RAG Knowledge Coverage & Catalog Alignment

## Architecture

Current sources:

- `backend/src/ai/rag/knowledgeSeed.ts` contains source ids used by retrieval.
- `backend/src/domain/serviceDeskCatalog.ts` exposes catalog article metadata.
- `frontend/src/views/agents/GovernanceView.tsx` derives governance metrics from tickets, traces, and audit entries.

This cycle keeps computation client-side in `GovernanceView` because all required data is already loaded by `refreshWorkspace()`. The backend change is catalog contract alignment.

## Backend Changes

- Extend `KnowledgeArticle` with:
  - `ownerGroupId: string`
  - `reviewCadenceDays: number`
  - `status: "active" | "needs_review"`
- Replace catalog ids with the seeded RAG ids:
  - `kb-erp-billing-lock`
  - `kb-vpn-instability`
  - `kb-access-reset`
  - `kb-priority-sla`
- Add integration coverage that creates an ERP ticket and verifies every retrieved source id is present in the catalog.

## Frontend Changes

- Extend `ServiceDeskCatalog.knowledgeArticles` type with new metadata.
- Pass `catalog` into `GovernanceView`.
- Build a `knowledgeHealth` model from:
  - active tickets
  - `ticket.ai.retrievedSources`
  - `catalog.knowledgeArticles`
- Add a "Saude da base RAG" panel showing:
  - active-ticket RAG coverage
  - cataloged vs uncataloged used sources
  - stale articles
  - top used sources
  - service gaps with no RAG source

## Testing

- Backend integration test for source/catalog alignment.
- Frontend TypeScript lint.
- Frontend build.
- E2E governance smoke for the knowledge panel.
- Compozy task validation.

## Risks

- Static catalog can drift again if new seed sources are added without tests. The new integration test guards that path.
- Client-side derived metrics are not historical. This is acceptable for this cycle.
