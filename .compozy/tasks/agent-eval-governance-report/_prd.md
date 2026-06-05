# Agent Eval Governance Report PRD

## Overview

Service Desk IA already runs curated backend evals for intake, ticket outcome, RAG grounding, and workflow trajectory. Operators cannot see that signal in the product. The governance view should expose a concise quality report so managers can distinguish live operational risk from regression risk in the AI workflow.

## Goals

- Show executable agent quality evidence in the AI governance dashboard.
- Make pass rate, aggregate score, failed cases, and failed scorers visible without leaving the app.
- Reuse the existing service desk eval suite instead of inventing a parallel metric.
- Keep the MVP read-only and small.

## User Stories

- As a manager, I want to see whether the curated AI behavior checks pass so I can trust the current AI workflow before expanding usage.
- As an admin, I want to identify which eval case or scorer failed so I can decide whether to inspect RAG, prompts, routing, or workflow spans.
- As an analyst lead, I want the eval signal beside traces and feedback so governance work is not split across terminal output and UI.

## Core Features

- Governance shows an "Agent evals" panel.
- The panel shows total cases, passed cases, pass rate, aggregate score, and latest generated time.
- The panel lists each eval case with pass/fail state and key scorer reasons.
- Failed cases are visibly prioritized.
- Empty or unavailable eval state degrades to a readable warning.

## User Experience

The report belongs in the existing governance dashboard as a dense operational panel. It should use the current product visual vocabulary: panels, badges, compact rows, restrained semantic color, and scannable labels. It should not create a separate landing page, chart-heavy report, or decorative hero.

## Non-Goals

- No persisted eval history.
- No UI for editing eval cases.
- No scheduled eval runner.
- No external LLM judge in this cycle.
- No new database table or artifact storage.

## Phased Rollout Plan

1. Expose a deterministic eval snapshot through the backend.
2. Render the snapshot in the governance dashboard.
3. Add tests and E2E coverage.
4. Later, consider persisted trends and feedback-to-eval case promotion.

## Success Metrics

- Governance view displays agent eval status for admin users.
- Backend API test verifies the report shape and passing deterministic baseline.
- Frontend build and E2E smoke verify the panel is visible.
- Existing backend eval suite still passes.

## Risks And Mitigations

- Runtime eval cost can grow as cases grow. Mitigate by using deterministic fallback and a small curated suite.
- Operators might read snapshot quality as full production monitoring. Mitigate with copy that labels the report as curated eval baseline.
- Duplicated eval fixtures can drift. Mitigate by moving cases into source code shared by tests and API.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Expose deterministic agent evals in AI governance.

## Open Questions

- Should future cycles persist eval trends by release or by model route?
- Should negative production feedback automatically create candidate eval cases?
