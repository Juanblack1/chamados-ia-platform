---
status: completed
title: Remove duplicate access-control components
type: frontend
complexity: low
dependencies: []
---

# Task 1: Remove duplicate access-control components

## Requirements

- `App.tsx` MUST not define local `GroupCheckboxes`.
- `App.tsx` MUST not define local `PermissionCheckboxes`.
- Active admin forms MUST keep using extracted access-control components.

## Subtasks

- [x] 1.1 Delete local `GroupCheckboxes`.
- [x] 1.2 Delete local `PermissionCheckboxes`.
- [x] 1.3 Confirm active admin references still use extracted components.

## Tests

- [x] Frontend lint passes.
