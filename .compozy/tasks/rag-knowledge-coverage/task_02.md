---
status: completed
title: Add governance knowledge health UI
type: frontend
complexity: medium
dependencies:
  - task_01
---

# Task 2: Add governance knowledge health UI

## Overview

Add an operational RAG health panel to the governance dashboard using loaded tickets and catalog metadata.

<requirements>
- Governance view MUST receive catalog data.
- Panel MUST show coverage, uncataloged sources, stale articles, top used sources, and service gaps.
- UI MUST remain responsive and consistent with the product register.
</requirements>

## Subtasks

- [x] 2.1 Extend frontend catalog type.
- [x] 2.2 Pass catalog into governance view.
- [x] 2.3 Build knowledge health model.
- [x] 2.4 Add panel and scoped styles.

## Relevant Files

- `frontend/src/lib/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/views/agents/GovernanceView.tsx`
- `frontend/src/styles.css`

## Tests

- [x] TypeScript validates catalog and model types.
- [x] E2E verifies panel visibility.
