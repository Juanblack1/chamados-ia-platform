---
status: completed
title: Extract ticket workspace view
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Extract ticket workspace view

## Requirements

- `TicketWorkspaceView` MUST move out of `App.tsx`.
- Existing props and behavior MUST remain unchanged.
- Workspace-only lazy chat loading SHOULD move with the view.
- `App.tsx` imports SHOULD be reduced.

## Subtasks

- [x] 1.1 Create `TicketWorkspaceView.tsx`.
- [x] 1.2 Move the workspace component and assignability helper.
- [x] 1.3 Move workspace-specific lazy chat import.
- [x] 1.4 Replace inline component in `App.tsx` with import.
- [x] 1.5 Clean unused imports.

## Tests

- [x] Frontend lint passes.
