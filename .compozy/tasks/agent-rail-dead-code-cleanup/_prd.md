# Agent Rail Dead Code Cleanup - PRD

## Problem

`AgentRail` is exported from `TicketWorkspacePanels.tsx` but has no consumers in `frontend/src`. Keeping unused UI code increases maintenance cost and makes the ticket workspace module look broader than it is.

## Goal

Remove the unused `AgentRail` component and any styles/imports that only support it.

## Users

- Developers maintaining ticket workspace and AI traceability surfaces.
- Analysts and managers indirectly benefit from lower regression risk in future UI work.

## Requirements

- Remove only code confirmed as unused.
- Preserve all active ticket, AI traceability and chat behavior.
- Keep the workspace visual system unchanged.

## Non-Goals

- No redesign.
- No changes to agent traceability panels.
- No changes to API or data structures.

## Success Metrics

- `rg "AgentRail" frontend/src` returns no matches.
- Frontend lint, build and E2E pass.
- Compozy task metadata validates.

