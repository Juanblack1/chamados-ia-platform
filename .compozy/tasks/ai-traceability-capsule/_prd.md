# PRD: AI Traceability Capsule

## Problem

The system records AI decisions, evidence, approvals, and spans, but analysts still need a compact view inside the ticket workspace that answers: which trace produced this decision, which model route ran, which API scope opened the work, and what policy gate controls the outcome.

## Goals

- Show trace ID and recent spans for the active ticket.
- Show model gateway route and execution mode for triage and resolution draft.
- Show API/request scope from the ticket context.
- Show policy status and human override affordance.
- Cover the behavior with backend and E2E tests.

## Non-Goals

- No trace search page.
- No external observability integration.
- No model-provider analytics warehouse.
- No change to approval semantics.

## Requirements

- Backend ticket decision metadata MUST include model route and execution mode.
- Workspace MUST show "Rastreabilidade IA" for worker-visible ticket details.
- Workspace MUST show trace id, model route, request scope, policy status, and recent spans.
- UI MUST remain responsive and consistent with the product register.
- E2E MUST verify the capsule is visible in the treatment workspace.
