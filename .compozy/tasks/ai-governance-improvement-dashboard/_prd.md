# AI Governance Improvement Dashboard PRD

## Overview

Service Desk IA needs a repeatable way to discover operational improvements from the data it already captures. Analysts and managers can see AI context inside a ticket, but they cannot quickly scan AI confidence, human approval pressure, trace failures, and queue risks across the service desk.

This feature adds an AI governance and improvement dashboard for analysts, managers, and administrators. It turns tickets, approvals, agent traces, and audit events into an actionable view of risk and recommended next improvements.

## Goals

- Give operators one screen for AI governance health across the authorized queue.
- Highlight low-confidence decisions, pending human review, SLA exposure, missing RAG evidence, and trace failures.
- Produce a ranked set of operational improvement recommendations with evidence counts.
- Reduce time to identify the next improvement opportunity from manual inspection to one dashboard scan.

## User Stories

- As a manager, I want to see where AI decisions need human attention so that governance does not block ticket resolution.
- As an analyst, I want to open risky tickets from a governance view so that I can act before SLA breaches.
- As an administrator, I want to see trace and audit health so that AI workflows remain explainable.
- As a product owner, I want recommended improvement themes so that each implementation cycle starts from operational evidence.

## Core Features

- Governance metrics: show pending approvals, low-confidence AI decisions, SLA exposure, trace errors, and average trace duration.
- Improvement recommendations: rank improvement cards by operational severity and evidence.
- Risk ticket list: expose tickets that need human action, have weak AI confidence, or have SLA risk.
- Agent activity: show recent trace spans and audit events in a compact operational feed.
- Direct action path: allow users to open a ticket from the governance dashboard.

## User Experience

The dashboard appears as "Governanca IA" in the main navigation for non-requester users. It uses dense operational cards, not marketing copy. The primary flow is:

1. User opens "Governanca IA".
2. User scans the top metrics for approval, SLA, confidence, and trace health.
3. User reviews recommended improvements and their evidence.
4. User opens a risky ticket or refreshes data after acting.

The view must remain responsive on mobile, preserve keyboard-accessible ticket rows, and use color as a secondary signal with labels and counts.

## High-Level Technical Constraints

- Must use the current authenticated service desk session.
- Must only show tickets already authorized for the current user.
- Must reuse existing audit and trace data where possible.
- Must work without external AI credentials.
- Must remain useful when there are no agent runs or no trace spans.

## Non-Goals (Out of Scope)

- Persisting recommendations as separate domain objects.
- Creating or executing code changes from inside the app.
- Adding a new AI model call to generate recommendations.
- Replacing per-ticket governance panels.
- Full OCR ingestion of the scanned architecture PDF.

## Phased Rollout Plan

### MVP (Phase 1)

- Add the governance dashboard view, navigation, recommendation cards, risk tickets, and activity feeds.
- Success criteria: non-requester users can open the view, see deterministic recommendations, and navigate to a risky ticket.

### Phase 2

- Add server-side aggregation and historical trend comparison.
- Success criteria: dashboard remains fast with larger ticket volumes and longer trace history.

### Phase 3

- Add persisted improvement backlog items tied to PRD, TechSpec, and task status.
- Success criteria: improvement recommendations can be tracked from discovery through implementation.

## Success Metrics

- Governance view renders for admin and analyst users in under 2 seconds locally.
- At least three recommendation types are generated from seeded tickets and traces.
- Users can navigate from a recommendation context to a ticket without losing queue state.
- No horizontal overflow on a 390px mobile viewport.
- Type checking, build, backend tests, and e2e smoke flow pass.

## Risks and Mitigations

- Risk: Operators may mistake heuristics for final AI evaluation. Mitigation: show evidence counts and operational labels.
- Risk: Empty data could make the dashboard feel broken. Mitigation: include stable empty states and next-step recommendations.
- Risk: The PDF cannot be used directly without OCR. Mitigation: record the limitation and continue with repository and market context.

## Architecture Decision Records

- [ADR-001: Surface AI governance as an operator dashboard](adrs/adr-001.md) - Reuse current ticket, audit, and trace data in a frontend governance surface before adding backend persistence.

## Open Questions

- Which metrics should become contractual KPIs for production operations?
- Should future recommendations create persistent backlog records?
- Should OCR be installed locally to extract the scanned architecture PDF in a later cycle?
