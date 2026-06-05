---
status: completed
title: Extract app chrome components
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Extract app chrome components

## Requirements

- `App.tsx` MUST NOT define local `Sidebar`.
- `App.tsx` MUST NOT define local `Topbar`.
- Extracted components MUST preserve navigation items, filters, theme controls and Copilot button.
- Filter/theme types MUST remain available to `App.tsx`.

## Subtasks

- [x] 1.1 Add `components/AppChrome.tsx`.
- [x] 1.2 Update `App.tsx` imports and state types.
- [x] 1.3 Remove local `Sidebar` and `Topbar`.
- [x] 1.4 Confirm references point to extracted components.

## Tests

- [x] Frontend lint passes.
