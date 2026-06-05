# AI Feedback Governance Analytics TechSpec

## Executive Summary

Add a frontend-only governance analytics model for AI decision feedback. The trade-off is scope versus history: this cycle computes current authorized-ticket analytics in the browser instead of adding backend aggregation or persistence.

## Scope

- Extend `buildGovernanceModel` with `feedbackHealth`.
- Derive rating counts, decision counts, negative count, and recent feedback rows from `ticket.ai.feedback`.
- Render a "Feedback humano" panel in `GovernanceView`.
- Add CSS and E2E coverage.

## System Design

The data is already loaded as part of `listTickets()`. `GovernanceView` will flatten ticket feedback into normalized row objects that include ticket number and title. The model will sort recent feedback by `createdAt` descending and calculate summary metrics.

## Core Interfaces

```ts
type FeedbackHealth = {
  total: number;
  useful: number;
  needsReview: number;
  incorrect: number;
  recent: FeedbackRow[];
};
```

## Frontend Design

The panel appears after agent evals and before RAG health. It contains:

- Four summary tiles: total, useful, review, incorrect.
- Decision split row for triage versus resolution draft.
- Recent feedback list with ticket and actor context.
- Empty state when no feedback exists.

## Testing Strategy

- Frontend TypeScript validates model types.
- Build validates CSS and JSX.
- Playwright records feedback in the treatment workspace, returns to governance, and checks the panel.

## Development Sequencing

1. Add the feedback health model in `GovernanceView`.
2. Render the panel and helper labels. Depends on step 1.
3. Add CSS and responsive behavior. Depends on step 2.
4. Extend E2E coverage. Depends on step 2.
5. Run verification and update tracking. Depends on steps 1 through 4.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Aggregate ticket-local AI feedback in governance.
