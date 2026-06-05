---
status: completed
title: Add verification coverage and update tracking
type: test
complexity: low
dependencies:
  - task_01
  - task_02
---

# Task 3: Add verification coverage and update tracking

## Overview

Extend automated checks to cover the governance dashboard and update task tracking only after verification passes. This keeps the new improvement loop accountable and repeatable.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details - do not duplicate here
- FOCUS ON "WHAT" - describe what needs to be accomplished, not how
- MINIMIZE CODE - show code only to illustrate current structure or problem areas
- TESTS REQUIRED - every task MUST include tests in deliverables
</critical>

<requirements>
- Playwright MUST verify the admin can open the governance dashboard.
- Playwright MUST verify mobile layout has no document-level horizontal overflow.
- Frontend lint and build MUST pass.
- Backend test suite MUST pass or any unrelated pre-existing failure MUST be documented.
- Task files and `_tasks.md` MUST be updated only after successful verification.
</requirements>

## Subtasks

- [x] 3.1 Add e2e assertions for the governance dashboard.
- [x] 3.2 Run frontend lint and build.
- [x] 3.3 Run backend tests.
- [x] 3.4 Run e2e smoke coverage.
- [x] 3.5 Mark task tracking complete with evidence.

## Implementation Details

Modify `frontend/e2e/service-desk.spec.ts` and tracking files under `.compozy/tasks/ai-governance-improvement-dashboard/`. Reference the TechSpec "Testing Approach" section.

### Relevant Files

- `frontend/e2e/service-desk.spec.ts` - browser smoke coverage.
- `package.json` - root verification scripts.
- `.compozy/tasks/ai-governance-improvement-dashboard/_tasks.md` - master task tracking.

### Dependent Files

- `frontend/src/views/agents/GovernanceView.tsx` - target UI under test.
- `frontend/src/App.tsx` - navigation under test.

### Related ADRs

- [ADR-001: Surface AI governance as an operator dashboard](adrs/adr-001.md) - Establishes the delivery scope being verified.

## Deliverables

- E2E coverage for the new screen.
- Verification output from lint, build, backend tests, and e2e.
- Updated task tracking files.
- Test coverage target >=80%.

## Tests

- Unit tests:
  - [x] Frontend TypeScript compile covers the new component and API types.
- Integration tests:
  - [x] Playwright admin flow opens "Governanca IA".
  - [x] Mobile overflow assertion passes after opening the governance screen.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Task files reflect completed work only after verification.
- The improvement loop has a complete PRD, TechSpec, task set, implementation, and evidence.
