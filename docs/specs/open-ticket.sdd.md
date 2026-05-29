# Spec: Open AI-Assisted Ticket

## Intent

An analyst or requester opens a service desk ticket from natural language. The system normalizes the request, retrieves knowledge, classifies urgency, and stores an audit trail.

## Acceptance criteria

- Given a valid request, when the ticket is created, then the API returns `201` with a ticket number.
- Given a description with business-critical impact, when triage runs, then priority is `critical` and status is `escalated`.
- Given missing LLM credentials, when triage runs, then deterministic fallback still returns category, priority, confidence, and sources.
- Given a low-confidence decision, when the UI renders analysis, then human review is required before creation.

## Events

- `ticket.created`
- `ticket.triaged`
- `agent.failed`
