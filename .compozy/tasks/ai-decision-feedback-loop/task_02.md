---
status: completed
title: Add workspace feedback UI
type: frontend
complexity: medium
dependencies:
  - task_01
---

# Task 2: Add workspace feedback UI

## Overview

Add compact feedback controls to the AI decision card in the ticket workspace. Analysts can rate the AI decision without leaving the ticket.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details - do not duplicate here
- FOCUS ON "WHAT" - describe what needs to be accomplished, not how
- MINIMIZE CODE - show code only to illustrate current structure or problem areas
- TESTS REQUIRED - every task MUST include tests in deliverables
</critical>

<requirements>
- Frontend API client MUST expose `recordAiFeedback`.
- AI decision card MUST show feedback controls for workers.
- Feedback submission MUST update the current ticket state.
- Latest feedback state MUST be visible.
</requirements>

## Subtasks

- [x] 2.1 Add frontend API types and client.
- [x] 2.2 Wire App mutation into ticket workspace.
- [x] 2.3 Add compact AI feedback panel.
- [x] 2.4 Add scoped CSS.

## Implementation Details

Modify `frontend/src/lib/api.ts`, `frontend/src/App.tsx`, and `frontend/src/styles.css`.

### Relevant Files

- `frontend/src/App.tsx` - ticket workspace and mutation flow.
- `frontend/src/lib/api.ts` - API contract.
- `frontend/src/styles.css` - AI decision card styles.

### Dependent Files

- `frontend/e2e/service-desk.spec.ts` - smoke validation.

### Related ADRs

- [ADR-001: Store AI decision feedback on the ticket](adrs/adr-001.md) - Defines user-visible feedback scope.

## Deliverables

- Feedback UI in the AI card.
- Updated ticket after feedback submission.
- Responsive styling.
- Test coverage target >=80%.

## Tests

- Unit tests:
  - [x] Frontend TypeScript validates feedback props and API contract.
- Integration tests:
  - [x] Admin e2e can see and submit AI feedback.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Feedback appears after submission without page reload.
