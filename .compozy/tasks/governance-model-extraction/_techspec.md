# Governance Model Extraction - TechSpec

## Current State

`frontend/src/views/agents/GovernanceView.tsx` imports UI icons and computes its own model through private helper functions. The render tree depends on `buildGovernanceModel`, eval helper labels, feedback helper labels and date formatters.

## Proposed Design

Create `frontend/src/views/agents/governanceModel.ts` with:

- governance recommendation and metric types;
- `buildGovernanceModel`;
- recommendation label/tone helpers;
- eval report and eval case helpers;
- feedback label/tone helpers;
- date formatting helpers.

`GovernanceView.tsx` will import those functions and keep only UI rendering plus presentation helpers for ticket badges.

## Boundaries

- `governanceModel.ts` may import `slaRisk` and metric icons because the model already includes icon references consumed by the view.
- `GovernanceView.tsx` keeps ticket row presentation helpers (`statusLabel`, `priorityLabel`, tones) because those are rendering-specific.

## Risk

- Moving inferred model types can expose private type issues in TypeScript.
- Icon imports can be duplicated or omitted.
- Date/label helpers must preserve existing Portuguese copy exactly.

## Verification

- `npm.cmd --workspace frontend run lint`
- `npm.cmd --workspace frontend run build`
- `npm.cmd run test:e2e`
- `compozy.cmd tasks validate --name governance-model-extraction`

