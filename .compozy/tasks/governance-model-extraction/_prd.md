# Governance Model Extraction - PRD

## Problem

`GovernanceView.tsx` is currently the largest frontend source file and mixes rendering with governance calculations, ranking, labels, date formatting, eval summaries, feedback health and RAG coverage analysis. This raises cognitive load for any future UI change in the governance surface.

## Goal

Extract the governance model and helper functions into a dedicated module while preserving the current view and behavior.

## Users

- Managers and admins reading AI governance data.
- Developers maintaining audit, eval, feedback and RAG health features.

## Requirements

- Keep `GovernanceView.tsx` focused on rendering.
- Move pure calculations and label helpers to `governanceModel.ts`.
- Preserve all current copy, ordering, labels, icons and tones.
- Avoid visual redesign in this cycle.

## Non-Goals

- No changes to backend data.
- No changes to eval semantics.
- No new governance metrics.
- No panel layout rewrite.

## Success Metrics

- `GovernanceView.tsx` line count is materially reduced.
- Frontend lint, build and E2E pass.
- Compozy task metadata validates.

