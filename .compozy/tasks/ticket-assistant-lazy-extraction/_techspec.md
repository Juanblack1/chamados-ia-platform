# Ticket Assistant Lazy Extraction TechSpec

## Executive Summary

Extract the assistant-ui ticket chat from `App.tsx` into `frontend/src/components/TicketAssistantChat.tsx` and lazy-load it in the ticket workspace. Move `localizeAgentContent` to `frontend/src/lib/aiText.ts` so both the workspace and chat can share the text normalization logic.

## Scope

- Add `lib/aiText.ts`.
- Add `components/TicketAssistantChat.tsx`.
- Replace local chat render in `TicketWorkspaceView` with a lazy component and fallback.
- Remove assistant-ui imports and chat-only helper functions from `App.tsx`.

## System Design

`App.tsx` keeps ticket orchestration:

```tsx
<Suspense fallback={<TicketAssistantChatFallback />}>
  <TicketAssistantChat ticket={ticket} onTicketUpdated={onTicketUpdated} onChat={onChat} />
</Suspense>
```

`TicketAssistantChat.tsx` owns assistant-ui runtime details:

```tsx
useExternalStoreRuntime<TicketAgentMemoryEntry>(...)
```

The existing streaming contract remains unchanged.

## Testing Strategy

- `rg` confirms `App.tsx` no longer imports `@assistant-ui/react`.
- Frontend lint validates extracted prop and helper types.
- Build validates the lazy module.
- E2E confirms detail workspace still loads.

## Development Sequencing

1. Add shared AI text helper.
2. Add lazy chat component.
3. Remove local chat code from `App.tsx`.
4. Run verification and update tracking.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Lazy-load the specialist ticket chat.
