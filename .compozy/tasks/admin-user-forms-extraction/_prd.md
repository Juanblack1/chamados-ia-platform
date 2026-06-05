# Admin User Forms Extraction - PRD

## Problem

`UserManagementViews.tsx` is now the largest frontend source file. It mixes exported admin views with dense user summary, security and edit/create form components. This makes user-management changes harder to review and increases the chance of regressions in unrelated admin screens.

## Goal

Move admin user form and support panels into a dedicated module while preserving user creation, editing, password strength and RBAC controls.

## Users

- Administrators managing users, groups and permissions.
- Developers maintaining admin user workflows.

## Requirements

- `UserManagementViews.tsx` MUST keep route-level/admin view components.
- User forms and support panels MUST move to `UserForms.tsx`.
- Create/edit behavior, validation and copy MUST stay unchanged.
- RBAC group and permission checkbox behavior MUST stay unchanged.

## Non-Goals

- No visual redesign.
- No auth/RBAC behavior change.
- No backend API change.

## Success Metrics

- `UserManagementViews.tsx` line count is materially reduced.
- Frontend lint, build and E2E pass.
- Compozy task metadata validates.

