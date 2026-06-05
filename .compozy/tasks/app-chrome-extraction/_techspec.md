# App Chrome Extraction TechSpec

## Executive Summary

Move the authenticated navigation sidebar and topbar from `App.tsx` into `frontend/src/components/AppChrome.tsx`. The new module owns chrome rendering and types for theme and queue filters, while `App.tsx` remains responsible for state, API orchestration and view composition.

## Scope

- Create `AppChrome.tsx`.
- Export `ThemePreference`, `SlaRiskFilter` and `AiConfidenceFilter`.
- Move `Sidebar` and `Topbar` unchanged except imports.
- Update `App.tsx` imports and remove local definitions.

## System Design

`App.tsx` continues to own state:

```tsx
const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
const [themeMode, setThemeMode] = useState<ThemePreference>(getInitialThemePreference);
```

`AppChrome.tsx` receives state and handlers as props:

```tsx
<Sidebar ... />
<Topbar ... />
```

No runtime behavior changes are intended.

## Testing Strategy

- `rg` confirms local chrome definitions are absent from `App.tsx`.
- Frontend lint verifies extracted props and imports.
- Frontend build confirms bundling.
- Playwright E2E confirms requester/admin flows and responsive workspace remain intact.

## Development Sequencing

1. Create component module and move chrome code.
2. Update imports and remove duplicate local definitions.
3. Run verification and metadata validation.
4. Update task tracking.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Keep app chrome in a dedicated component module.
