---
status: completed
title: Remove legacy local view blocks
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Remove legacy local view blocks

## Requirements

- `App.tsx` MUST not define local `IntakeView`.
- `App.tsx` MUST not define local `IntakeIntelligencePanel`.
- `App.tsx` MUST not define local `DetailView`.
- Active helpers used by `TicketWorkspaceView` MUST remain.

## Subtasks

- [x] 1.1 Delete local intake block.
- [x] 1.2 Delete local detail block.
- [x] 1.3 Remove unused imports.
- [x] 1.4 Confirm symbols are absent.

## Tests

- [x] Frontend lint passes.
