---
status: completed
title: Add governance dashboard UI and navigation
type: frontend
complexity: medium
dependencies:
  - task_01
---

# Task 2: Add governance dashboard UI and navigation

## Overview

Create the "Governanca IA" screen for non-requester users and render operational recommendations from tickets, traces, and audit entries. The screen should make the next improvement opportunity visible without adding a new backend subsystem.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details - do not duplicate here
- FOCUS ON "WHAT" - describe what needs to be accomplished, not how
- MINIMIZE CODE - show code only to illustrate current structure or problem areas
- TESTS REQUIRED - every task MUST include tests in deliverables
</critical>

<requirements>
- The sidebar MUST include "Governanca IA" for non-requester users.
- The topbar MUST show the correct title for the new view.
- The dashboard MUST show governance metrics, recommendations, risk tickets, recent spans, and recent audit events.
- Ticket rows in the governance view MUST open the selected ticket workspace.
- The layout MUST avoid horizontal overflow on mobile.
</requirements>

## Subtasks

- [x] 2.1 Create the governance dashboard component.
- [x] 2.2 Add recommendation and metric rendering.
- [x] 2.3 Wire sidebar, topbar, and view rendering.
- [x] 2.4 Add scoped responsive CSS.

## Implementation Details

Create `frontend/src/views/agents/GovernanceView.tsx` and modify `frontend/src/App.tsx`, `frontend/src/lib/presentation.ts`, and `frontend/src/styles.css`. Reference the TechSpec "Component Overview" and "Impact Analysis" sections.

### Relevant Files

- `frontend/src/views/tickets/DashboardView.tsx` - existing dashboard composition patterns.
- `frontend/src/components/common.tsx` - shared badge and skeleton components.
- `frontend/src/styles.css` - shared visual tokens and responsive rules.

### Dependent Files

- `frontend/e2e/service-desk.spec.ts` - must validate the new navigation in task 03.

### Related ADRs

- [ADR-001: Surface AI governance as an operator dashboard](adrs/adr-001.md) - Defines the dashboard-first delivery.

## Deliverables

- New governance dashboard screen.
- Navigation and topbar support for the new view.
- Responsive styles for desktop and mobile.
- Frontend lint/build validation.

## Tests

- Unit tests:
  - [x] TypeScript validates props, metrics, and recommendation models.
  - [x] Empty data state renders without crashing.
- Integration tests:
  - [x] Admin user can open "Governanca IA".
  - [x] Clicking a risk ticket opens the ticket workspace.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- The governance screen exposes actionable recommendations.
- No mobile horizontal overflow.
