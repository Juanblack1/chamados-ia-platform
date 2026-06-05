---
status: completed
title: Add governance data access and view model
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Add governance data access and view model

## Overview

Add typed frontend access to agent audit runs and define deterministic governance view models from tickets, traces, and audit entries. This creates the data foundation for the governance dashboard without adding backend persistence.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details - do not duplicate here
- FOCUS ON "WHAT" - describe what needs to be accomplished, not how
- MINIMIZE CODE - show code only to illustrate current structure or problem areas
- TESTS REQUIRED - every task MUST include tests in deliverables
</critical>

<requirements>
- The frontend MUST define an `AgentAuditEntry` type matching `/api/agents/runs`.
- The frontend MUST expose `listAgentRuns()`.
- The app MUST load audit entries during workspace refresh with existing ticket, trace, and catalog data.
- Derived governance data MUST remain deterministic and not call external AI models.
</requirements>

## Subtasks

- [x] 1.1 Add audit run type and API client.
- [x] 1.2 Add app state for audit runs.
- [x] 1.3 Load audit runs during workspace refresh.
- [x] 1.4 Ensure requester authorization behavior remains unchanged.

## Implementation Details

Modify `frontend/src/lib/api.ts` and `frontend/src/App.tsx`. Reference the TechSpec "Core Interfaces" and "Development Sequencing" sections.

### Relevant Files

- `frontend/src/lib/api.ts` - API client types and fetch functions.
- `frontend/src/App.tsx` - app state and workspace refresh orchestration.
- `backend/src/http/routes/agents.ts` - existing source route for audit runs.

### Dependent Files

- `frontend/src/views/agents/GovernanceView.tsx` - consumes audit runs in task 02.

### Related ADRs

- [ADR-001: Surface AI governance as an operator dashboard](adrs/adr-001.md) - Defines the client-side aggregation approach.

## Deliverables

- Typed audit run API client.
- App refresh includes audit runs.
- Unit/type validation through frontend lint.
- Integration validation through e2e in task 03.

## Tests

- Unit tests:
  - [x] TypeScript accepts `AgentAuditEntry` and `listAgentRuns()`.
  - [x] `refreshWorkspace()` loads tickets, traces, audit runs, and catalog together.
- Integration tests:
  - [x] Existing login and queue flows remain functional after the new fetch.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Audit entries are available to the governance view.
- Existing ticket workspace loading still works.
