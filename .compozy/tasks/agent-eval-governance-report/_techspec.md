# Agent Eval Governance Report TechSpec

## Executive Summary

Add a read-only eval report path that reuses the existing service desk eval scorers and cases. The main trade-off is runtime execution versus persisted history: this cycle chooses on-demand deterministic execution because it avoids new storage while making the existing quality signal visible.

## Scope

- Move curated service desk eval cases and the isolated eval runner into `backend/src/ai/evals`.
- Add `GET /api/agents/evals`.
- Add frontend API types and a `listAgentEvalReport` request.
- Pass the report into `GovernanceView`.
- Render a compact eval quality panel and cover it with tests.

## System Design

The backend route runs evals in a fresh in-memory orchestrator so it does not mutate the live ticket queue. The runner forces deterministic fallback settings and returns a serializable report. The existing `backend/tests/agent-evals.test.ts` imports the same runner to avoid fixture drift.

The frontend loads the report with tickets, traces, runs, and catalog. `GovernanceView` receives the report as optional data and renders it near the current agent health section.

## Core Interfaces

```ts
export type ServiceDeskEvalReport = {
  generatedAt: string;
  score: number;
  passRate: number;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  cases: ServiceDeskEvalCaseReport[];
};
```

## API Design

- `GET /api/agents/evals`
- Authenticated route using the existing access guard.
- Returns `ServiceDeskEvalReport`.
- Uses deterministic in-memory eval execution.

## Frontend Design

`GovernanceView` adds one panel titled "Evals dos agentes". It uses the same panel and badge system as RAG health and trace health. The panel contains:

- Summary cards for pass rate, aggregate score, and failed cases.
- A compact case list with pass/fail badges and scorer details.
- A readable empty/error state if the report is unavailable.

## Testing Strategy

- Backend unit/eval test keeps asserting every curated case passes.
- Backend integration test verifies `/api/agents/evals` returns a passing deterministic report.
- Frontend lint and build verify type coverage.
- Playwright governance smoke checks the eval panel appears.

## Development Sequencing

1. Create the shared backend eval suite module.
2. Add the backend route and integration coverage. Depends on step 1.
3. Add frontend API type and workspace loading state. Depends on step 2.
4. Render the governance panel and E2E assertion. Depends on step 3.
5. Run verification and update tracking. Depends on steps 1 through 4.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Expose deterministic agent evals in AI governance.
