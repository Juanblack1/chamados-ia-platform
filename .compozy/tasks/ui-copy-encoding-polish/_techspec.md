# UI Copy Encoding Polish TechSpec

## Executive Summary

Replace the remaining mojibake separators in `frontend/src/App.tsx` with the existing ASCII-safe ` - ` separator convention. This keeps the UI copy stable in source control, terminal output and browser rendering.

## Scope

- Update SLA policy copy in the admin legacy panel.
- Update compact SLA badge copy.
- Search frontend source for remaining mojibake artifacts.
- Run frontend lint and build.

## System Design

The change is source-copy only:

```tsx
"Resposta ... min - Resolucao ... min"
`${ticket.sla.label} - ${relativeDue(due)}`
```

No component contracts, props or styles change.

## Testing Strategy

- Run `rg "Ã|Â" frontend/src`.
- Run `npm.cmd --workspace frontend run lint`.
- Run `npm.cmd --workspace frontend run build`.
- Validate task metadata.

## Development Sequencing

1. Replace remaining corrupted separators.
2. Search for residual artifacts.
3. Run lint and build.
4. Validate metadata and update tasks.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Use ASCII-safe separators for operational copy.
