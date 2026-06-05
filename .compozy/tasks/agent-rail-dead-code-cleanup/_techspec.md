# Agent Rail Dead Code Cleanup - TechSpec

## Current State

`frontend/src/views/tickets/TicketWorkspacePanels.tsx` exports `AgentRail`, but no module imports or renders it. The component depends on `Bot`, `FileSearch`, `ShieldCheck`, `UsersRound`, `ClipboardList`, `formatTimelineDate` and local rendering classes.

## Proposed Design

Delete `AgentRail` and remove imports that become unused. Search CSS for dedicated `agent-rail` selectors and remove them if they are not shared with active components.

## Risk

- Removing shared CSS by selector prefix could affect another active surface if class names overlap.
- Removing icon imports must be validated by TypeScript.

## Verification

- `rg "AgentRail" frontend/src`
- `npm.cmd --workspace frontend run lint`
- `npm.cmd --workspace frontend run build`
- `npm.cmd run test:e2e`
- `compozy.cmd tasks validate --name agent-rail-dead-code-cleanup`

