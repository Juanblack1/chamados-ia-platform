# App Shell Legacy View Cleanup TechSpec

## Executive Summary

Remove unreachable legacy screen functions from `App.tsx`. The live intake route uses `TicketIntakeView`, and the live detail route uses `TicketWorkspaceView`, so local `IntakeView`, `IntakeIntelligencePanel`, and `DetailView` can be deleted.

## Scope

- Remove local `IntakeView`.
- Remove local `IntakeIntelligencePanel`.
- Remove local `DetailView`.
- Clean up now-unused imports.
- Run frontend verification.

## System Design

No runtime behavior changes. The active route bindings remain:

```tsx
<TicketIntakeView ... />
<TicketWorkspaceView ... />
```

Shared helpers below the removed detail block remain because they are used by `TicketWorkspaceView`.

## Testing Strategy

- `rg` confirms legacy function symbols are absent.
- TypeScript lint catches unused imports or references.
- Build confirms bundling.
- Playwright confirms intake, queue, treatment, governance, feedback, assignment, and mobile no-overflow flows still pass.

## Development Sequencing

1. Delete legacy local view blocks.
2. Remove unused imports reported by lint.
3. Run frontend lint/build/E2E.
4. Validate task metadata.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Keep app shell focused by deleting legacy local views.
