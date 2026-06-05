---
status: completed
title: Extract active user-management views
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Extract active user-management views

## Requirements

- `ProfileView`, `UserDirectoryView`, `UserCreatePage` and `UserDetailPage` MUST live outside `App.tsx`.
- Supporting helpers SHOULD remain private to the new module.
- Active route rendering in `App.tsx` MUST remain unchanged.

## Subtasks

- [x] 1.1 Create `UserManagementViews.tsx`.
- [x] 1.2 Export routed user/profile views.
- [x] 1.3 Import extracted views in `App.tsx`.
- [x] 1.4 Remove moved code from `App.tsx`.
- [x] 1.5 Clean unused imports.

## Tests

- [x] Frontend lint passes.
