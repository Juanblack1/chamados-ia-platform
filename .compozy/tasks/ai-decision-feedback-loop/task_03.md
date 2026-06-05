---
status: completed
title: Add tests, verification, and tracking
type: test
complexity: low
dependencies:
  - task_01
  - task_02
---

# Task 3: Add tests, verification, and tracking

## Overview

Verify the AI feedback loop and update workflow tracking after evidence is collected. This keeps the loop auditable like the feature itself.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details - do not duplicate here
- FOCUS ON "WHAT" - describe what needs to be accomplished, not how
- MINIMIZE CODE - show code only to illustrate current structure or problem areas
- TESTS REQUIRED - every task MUST include tests in deliverables
</critical>

<requirements>
- Backend tests MUST cover feedback authorization and persistence.
- E2E MUST cover visible feedback controls and successful submission.
- Lint, build, backend tests, and E2E MUST pass before tracking is completed.
- Compozy task validation MUST pass or command limitations must be documented.
</requirements>

## Subtasks

- [x] 3.1 Add e2e coverage.
- [x] 3.2 Run lint and build.
- [x] 3.3 Run backend tests.
- [x] 3.4 Run e2e.
- [x] 3.5 Validate tasks and update tracking.

## Implementation Details

Modify `frontend/e2e/service-desk.spec.ts` and tracking files under `.compozy/tasks/ai-decision-feedback-loop/`.

### Relevant Files

- `frontend/e2e/service-desk.spec.ts` - browser smoke test.
- `.compozy/tasks/ai-decision-feedback-loop/_tasks.md` - tracking.

### Dependent Files

- `backend/tests/api.integration.test.ts` - backend coverage.

### Related ADRs

- [ADR-001: Store AI decision feedback on the ticket](adrs/adr-001.md) - Scope under verification.

## Deliverables

- Automated coverage.
- Fresh verification evidence.
- Completed task tracking.
- Test coverage target >=80%.

## Tests

- Unit tests:
  - [x] TypeScript compile covers feedback types.
- Integration tests:
  - [x] Backend API test passes.
  - [x] Playwright feedback smoke passes.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- AI feedback loop is implemented and tracked.
