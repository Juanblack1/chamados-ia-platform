# Copilot On-Demand Loading TechSpec

## Executive Summary

Move CopilotKit mounting out of the app shell and into a lazy `CopilotWorkspace` component. The app shell keeps rendering immediately, and the optional Copilot provider/popup chunk loads only after the Copilot button is clicked.

## Scope

- Add `frontend/src/components/CopilotWorkspace.tsx`.
- Update `frontend/src/App.tsx` to lazy-load `CopilotWorkspace`.
- Replace the full-workspace Suspense fallback with a small Copilot loading fallback.
- Remove the old `WorkspaceFallback` component if it becomes unused.

## System Design

Current flow:

```tsx
<Suspense fallback={<WorkspaceFallback />}>
  <CopilotKit>
    <AppShell />
    <CopilotPopup />
  </CopilotKit>
</Suspense>
```

Target flow:

```tsx
<AppShell />
{copilotLaunchKey > 0 ? (
  <Suspense fallback={<CopilotLoadingFallback />}>
    <CopilotWorkspace launchKey={copilotLaunchKey} runtimeUrl={copilotRuntimeUrl} />
  </Suspense>
) : null}
```

The ticket-level `assistant-ui` runtime remains local to `TicketAssistantChat` and is not affected.

## Testing Strategy

- TypeScript lint confirms lazy component props and removed references.
- Build confirms the new dynamic import compiles.
- E2E confirms requester/admin core flows still render and operate.
- Compozy validation confirms the cycle metadata is valid.

## Development Sequencing

1. Add lazy Copilot component.
2. Refactor `App.tsx` render boundary.
3. Add compact Copilot loading CSS.
4. Run verification and update tracking.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Load optional Copilot UI only on demand.
