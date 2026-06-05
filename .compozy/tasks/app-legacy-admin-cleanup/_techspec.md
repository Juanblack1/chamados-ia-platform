# App Legacy Admin Cleanup TechSpec

## Executive Summary

Clean `frontend/src/App.tsx` by removing inactive legacy admin/user components and using the existing shared `SlaBadge` from `frontend/src/components/common.tsx`. This is a deletion-first cleanup that reduces future extraction risk.

## Scope

- Remove dead `UsersView`, `AdminView` and `UserEditorRow`.
- Remove unused local `SkeletonRows` and `readFileAsDataUrl`.
- Remove local `SlaBadge` and import the shared one.
- Update imports for newly unused symbols.

## System Design

The active route rendering remains unchanged:

```tsx
{view === "users" ? <UserDirectoryView ... /> : null}
{view === "userCreate" ? <UserCreatePage ... /> : null}
{view === "userDetail" ? <UserDetailPage ... /> : null}
```

Ticket workspace keeps rendering:

```tsx
<SlaBadge ticket={ticket} />
```

but the symbol now comes from `components/common`.

## Testing Strategy

- Search removed component names in `App.tsx`.
- Run `npm.cmd --workspace frontend run lint`.
- Run `npm.cmd --workspace frontend run build`.
- Run `npm.cmd run test:e2e`.
- Validate task metadata.

## Development Sequencing

1. Update shared common import.
2. Delete inactive local component blocks.
3. Remove unused imports.
4. Verify and update task tracking.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Remove inactive App-local admin surfaces before larger extraction.
