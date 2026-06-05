---
status: completed
title: Build governance feedback model
type: frontend
complexity: low
dependencies: []
---

# Task 1: Build governance feedback model

## Requirements

- Governance model MUST aggregate `ticket.ai.feedback`.
- Model MUST count total, useful, review-needed, incorrect, triage, and resolution draft feedback.
- Model MUST sort recent feedback by newest first.

## Subtasks

- [x] 1.1 Add feedback row type.
- [x] 1.2 Build `feedbackHealth` from active ticket data.
- [x] 1.3 Add helper labels for rating and decision.

## Tests

- [x] Frontend TypeScript validates the model.
