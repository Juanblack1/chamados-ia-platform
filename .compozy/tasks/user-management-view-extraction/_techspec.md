# User Management View Extraction TechSpec

## Executive Summary

Move active profile and user-management screen components from `App.tsx` into `frontend/src/views/admin/UserManagementViews.tsx`. Export only the routed views and keep helper components internal.

## Scope

- Create `UserManagementViews.tsx`.
- Move profile, directory, create and detail page implementations.
- Export routed components.
- Import those components from `App.tsx`.
- Remove imports from `App.tsx` that are only used by the moved code.

## System Design

New module:

```ts
export function ProfileView(...)
export function UserDirectoryView(...)
export function UserCreatePage(...)
export function UserDetailPage(...)
```

Private helpers remain in the same module:

```ts
function UserSummaryStrip(...)
function UserSecurityPanel(...)
function CreateUserForm(...)
function UserDetailPanel(...)
```

`App.tsx` keeps only route orchestration:

```tsx
{view === "users" ? <UserDirectoryView ... /> : null}
```

## Testing Strategy

- Run frontend lint.
- Run frontend build.
- Run E2E, which covers profile-adjacent auth state and admin user creation.
- Validate task metadata.

## Development Sequencing

1. Move the cohesive user-management block.
2. Export routed views from the new module.
3. Update `App.tsx` imports.
4. Remove unused imports.
5. Run verification and update tracking.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Keep App focused on orchestration, not admin form implementation.
