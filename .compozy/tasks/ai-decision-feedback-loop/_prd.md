# AI Decision Feedback Loop PRD

## Overview

Service Desk IA can explain AI decisions and require human approval, but it does not yet capture whether analysts found an AI decision useful, questionable, or wrong. Without this feedback, governance remains mostly observational and future improvement work lacks direct operator evidence.

This feature lets authorized ticket workers record structured feedback on AI decisions inside the ticket workspace.

## Goals

- Let analysts record quick, structured feedback for AI triage and resolution draft decisions.
- Preserve feedback with actor, timestamp, optional note, and audit trail.
- Make the latest feedback visible inside the ticket workspace.
- Create a data foundation for future agent evals and governance metrics.

## User Stories

- As an analyst, I want to mark an AI decision as useful so that good decisions can be recognized.
- As an analyst, I want to flag a decision that needs review so that governance can catch uncertain outputs.
- As a manager, I want AI feedback to be auditable so that quality signals can support future improvement work.
- As an administrator, I want feedback captured as structured data so that later dashboards and evals can use it.

## Core Features

- Feedback controls: allow workers to submit "useful", "needs review", or "incorrect" feedback on the AI triage decision.
- Feedback note: allow an optional short note explaining the rating.
- Auditability: store actor, decision target, rating, note, and timestamp.
- Ticket visibility: show the latest feedback count and last feedback state in the AI context card.

## User Experience

The feedback control appears inside the AI decision card in the ticket workspace. It uses compact buttons and a note input, not a modal. The workflow is:

1. Analyst opens a triaged ticket.
2. Analyst reviews the AI summary and evidence.
3. Analyst selects a feedback rating, optionally adds a note, and submits.
4. The card updates with the latest feedback and remains in the same workspace.

## High-Level Technical Constraints

- Only users allowed to work the ticket can record AI feedback.
- Feedback must be scoped to the current ticket.
- The feature must work with memory and Redis ticket repositories.
- No external model call is required.

## Non-Goals (Out of Scope)

- Training or fine-tuning models from feedback.
- Organization-wide feedback analytics.
- Feedback moderation workflow.
- New notification system.

## Phased Rollout Plan

### MVP (Phase 1)

- Store and show ticket-local AI feedback for triage decisions.
- Success criteria: API, UI, backend tests, e2e smoke, lint, and build pass.

### Phase 2

- Add dashboard aggregation for AI feedback.
- Success criteria: governance view includes feedback rates and tickets needing review.

### Phase 3

- Feed curated feedback into offline eval cases.
- Success criteria: eval suite can include feedback-derived scenarios.

## Success Metrics

- Authorized worker can submit feedback in under 10 seconds from the workspace.
- Unauthorized requester cannot submit AI feedback.
- Feedback appears on the ticket after submission without full page reload.
- Backend test covers success and permission denial.
- E2E test covers visible feedback controls.

## Risks and Mitigations

- Risk: Analysts may skip notes and produce weak signals. Mitigation: rating is required; note remains optional to keep the flow fast.
- Risk: Feedback is confused with approval. Mitigation: UI copy labels it as quality feedback, separate from human approval.

## Architecture Decision Records

- [ADR-001: Store AI decision feedback on the ticket](adrs/adr-001.md) - Use ticket-local feedback before adding a global feedback repository.

## Open Questions

- Should future feedback require notes for "incorrect" decisions?
- Should requester-facing AI answers support separate feedback?
- Which feedback signals should feed agent evals first?
