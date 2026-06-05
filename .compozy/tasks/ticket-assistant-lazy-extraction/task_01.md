---
status: completed
title: Extract lazy ticket assistant chat
type: frontend
complexity: medium
dependencies: []
---

# Task 1: Extract lazy ticket assistant chat

## Requirements

- `App.tsx` MUST NOT import `@assistant-ui/react`.
- Ticket assistant chat MUST live in a dedicated component module.
- AI text localization MUST be reusable by the app and chat.
- Ticket workspace MUST render a compact fallback while the lazy chat loads.

## Subtasks

- [x] 1.1 Add shared AI text helper.
- [x] 1.2 Add `TicketAssistantChat` component.
- [x] 1.3 Lazy-render chat from `TicketWorkspaceView`.
- [x] 1.4 Remove chat-only code from `App.tsx`.

## Tests

- [x] Frontend lint passes.
