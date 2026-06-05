# AI Feedback Governance Analytics PRD

## Overview

Analysts can record structured feedback for AI decisions, but managers cannot see quality patterns across tickets. Governance should summarize human feedback so the team can spot decisions that were useful, needed review, or were incorrect.

## Goals

- Surface aggregate human feedback in the AI governance dashboard.
- Show rating distribution and decision type distribution.
- Highlight recent negative or review-needed feedback.
- Connect feedback analytics to continuous improvement actions.

## User Stories

- As a manager, I want to see how much AI feedback exists so I know whether the team is closing the human review loop.
- As an admin, I want to see incorrect and review-needed counts so I can decide whether to update prompts, RAG content, or eval cases.
- As an analyst lead, I want recent feedback notes visible in governance so I can triage quality issues without opening every ticket.

## Core Features

- Governance panel titled "Feedback humano".
- Summary counters for total feedback, useful, review-needed, and incorrect ratings.
- Split by decision type: triage and resolution draft.
- Recent feedback list with ticket number, decision, rating, actor, and note when present.
- Recommendation copy when review-needed or incorrect feedback exists.

## User Experience

The panel should be compact and operational. It should look like a quality control widget, not a survey dashboard. It should fit the current product UI: badges, restrained semantic colors, dense rows, and responsive grids.

## Non-Goals

- No feedback editing.
- No persisted trend history.
- No automatic eval case generation.
- No backend endpoint in this cycle.

## Phased Rollout Plan

1. Aggregate feedback from loaded tickets.
2. Render the governance panel.
3. Add E2E coverage after recording feedback.
4. Later, connect incorrect feedback to eval candidate creation.

## Success Metrics

- Governance shows feedback analytics after a worker records feedback.
- E2E verifies review-needed feedback appears in governance.
- Frontend lint and build pass.

## Risks And Mitigations

- Low sample size can mislead. Mitigate by showing total feedback clearly.
- Authorized ticket scope can hide organization-wide feedback. Mitigate by labeling the panel as current workspace scope.
- Notes may be long. Mitigate by truncating visually with accessible row layout.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Aggregate ticket-local AI feedback in governance.

## Open Questions

- Should future cycles promote incorrect feedback into eval candidates?
- Should feedback analytics include per-agent owner accountability?
