---
status: completed
title: Extract ticket workspace support panels
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Extract ticket workspace support panels

## Requirements

- Workspace support panels MUST live outside `App.tsx`.
- `TicketWorkspaceView` MUST keep the same behavior and props.
- Helper functions SHOULD be private unless still needed by `App.tsx`.

## Subtasks

- [x] 1.1 Create `TicketWorkspacePanels.tsx`.
- [x] 1.2 Export workspace panel components.
- [x] 1.3 Export timeline helpers needed by `TicketWorkspaceView`.
- [x] 1.4 Remove moved code from `App.tsx`.
- [x] 1.5 Clean unused imports.

## Tests

- [x] Frontend lint passes.
