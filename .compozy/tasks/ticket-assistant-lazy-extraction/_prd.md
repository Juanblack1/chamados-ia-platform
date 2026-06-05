# Ticket Assistant Lazy Extraction PRD

## Overview

`App.tsx` imports `@assistant-ui/react` at the top level because the ticket detail view contains the specialist chat. This makes a heavy optional chat runtime part of the main app module, even for dashboard, queue and admin workflows that do not use the ticket chat immediately.

## Goals

- Move the ticket specialist chat into its own component module.
- Lazy-load the assistant-ui runtime only when the ticket workspace renders the chat.
- Keep the existing chat behavior, copy, memory conversion and streaming flow.
- Share AI text localization through a small helper instead of keeping it trapped in `App.tsx`.

## User Stories

- As an analyst, I want dashboard and queue workflows to load without pulling chat runtime code upfront.
- As a support specialist, I want the ticket chat to behave exactly as before when I open a ticket.
- As a maintainer, I want assistant-ui code isolated from the main app orchestrator.

## Core Features

- Add a lazy `TicketAssistantChat` component.
- Move assistant-ui imports and chat-specific helper functions out of `App.tsx`.
- Add a shared `localizeAgentContent` helper.
- Add a compact Suspense fallback for the ticket chat panel.

## Non-Goals

- No chat API changes.
- No message model changes.
- No visual redesign of the chat panel.
- No removal of the assistant-ui dependency.

## Success Metrics

- `App.tsx` no longer imports `@assistant-ui/react`.
- Ticket chat still appears in the detail workspace.
- Frontend lint, build, E2E, and Compozy validation pass.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Lazy-load the specialist ticket chat.
