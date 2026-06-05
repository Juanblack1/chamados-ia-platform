# Admin User Forms Extraction - TechSpec

## Current State

`frontend/src/views/admin/UserManagementViews.tsx` defines both exported views and internal components:

- `UserSummaryStrip`;
- `UserSecurityPanel`;
- `PasswordStrength`;
- `passwordStrength`;
- `CreateUserForm`;
- `UserDetailPanel`.

## Proposed Design

Create `frontend/src/views/admin/UserForms.tsx` and move the internal user form/support components there. Export only the components consumed by `UserManagementViews.tsx`; keep `PasswordStrength` and `passwordStrength` private.

`UserManagementViews.tsx` will import:

- `CreateUserForm`;
- `UserDetailPanel`;
- `UserSecurityPanel`;
- `UserSummaryStrip`.

## Risk

- Moving form components can leave unused API and icon imports in `UserManagementViews.tsx`.
- `useEffect` is required by `UserDetailPanel` after the move and should no longer be imported by `UserManagementViews.tsx` unless still used.
- RBAC checkbox imports must move with the forms.

## Verification

- `npm.cmd --workspace frontend run lint`
- `npm.cmd --workspace frontend run build`
- `npm.cmd run test:e2e`
- `compozy.cmd tasks validate --name admin-user-forms-extraction`

