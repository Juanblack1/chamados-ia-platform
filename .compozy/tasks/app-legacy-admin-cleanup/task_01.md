---
status: completed
title: Remove inactive App legacy components
type: frontend
complexity: low
dependencies: []
---

# Task 1: Remove inactive App legacy components

## Requirements

- Active user-management routes MUST keep rendering current page components.
- `App.tsx` MUST use the shared `SlaBadge`.
- Removed legacy component names MUST NOT remain defined in `App.tsx`.

## Subtasks

- [x] 1.1 Import shared `SlaBadge`.
- [x] 1.2 Remove local duplicate `SlaBadge`.
- [x] 1.3 Remove inactive `UsersView`, `AdminView` and `UserEditorRow`.
- [x] 1.4 Remove unused local `SkeletonRows` and `readFileAsDataUrl`.
- [x] 1.5 Clean unused imports.

## Tests

- [x] Removed component search passes.
