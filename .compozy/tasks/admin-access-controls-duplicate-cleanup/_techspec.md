# Admin Access Controls Duplicate Cleanup TechSpec

## Executive Summary

Remove unreachable local access-control components from `frontend/src/App.tsx`. The live user creation and detail forms already call the imported `AdminGroupCheckboxes` and `AdminPermissionCheckboxes`, so the local `GroupCheckboxes` and `PermissionCheckboxes` definitions are dead code.

## Scope

- Delete local `GroupCheckboxes` from `App.tsx`.
- Delete local `PermissionCheckboxes` from `App.tsx`.
- Preserve imports from `views/admin/AccessControls`.
- Run frontend and task validation.

## System Design

No runtime behavior changes. Active admin forms continue using:

```tsx
<AdminPermissionCheckboxes ... />
<AdminGroupCheckboxes ... />
```

The extracted source remains:

```txt
frontend/src/views/admin/AccessControls.tsx
```

## Testing Strategy

- `rg` confirms local component definitions are absent.
- Frontend lint catches unused imports or stale references.
- Frontend build confirms the app still bundles.
- Playwright E2E confirms the core service-desk flows still pass.

## Development Sequencing

1. Document cleanup cycle.
2. Delete duplicate local component definitions.
3. Run frontend lint/build/E2E.
4. Validate Compozy task metadata.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Keep admin access controls as extracted shared components.
