# Spec: Agent Governance

## Intent

Every AI decision must be explainable, auditable, and reversible by a human operator.

## Acceptance criteria

- Agent decisions include confidence, evidence IDs, created time, and agent name.
- RAG sources include title, source, excerpt, and relevance.
- Audit log records ticket creation, triage completion, and agent failures.
- Trace spans record workflow, RAG, agent, and tool-call execution with duration and status.
- UI shows the model gateway route, trace ID, API scope, policy status, and human override affordance.
