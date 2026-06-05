# Queue Operational Filters PRD

## Overview

The analyst queue already shows priority, SLA, service, requester, group, and AI confidence, but operators can only filter by status and text. Add quick filters for the highest-impact operational dimensions: priority, SLA risk, and AI confidence.

## Goals

- Help analysts isolate urgent work without text search.
- Support the production plan requirement for SLA, priority, and AI confidence scanning.
- Keep filtering immediate and reversible.
- Avoid backend scope in this MVP.

## User Stories

- As an analyst, I want to filter for critical tickets so I can focus on P1/P2 work first.
- As a manager, I want to filter for breached or warning SLA tickets so I can run rescue actions.
- As an analyst lead, I want to filter low-confidence AI tickets so I can review weak triage before action.

## Core Features

- Queue topbar includes priority filter.
- Queue topbar includes SLA risk filter.
- Queue topbar includes AI confidence filter.
- Filters combine with existing status filter and search.
- Dashboard shortcuts reset unrelated filters when opening the queue.

## User Experience

The filters should feel like standard internal-tool controls: compact selects with icons, familiar labels, and no modal. They should wrap in the existing topbar on narrow screens and preserve the mobile no-horizontal-overflow rule.

## Non-Goals

- No saved views.
- No backend query parameters.
- No group or assignee filter in this cycle.
- No table sorting changes.

## Phased Rollout Plan

1. Add filter state and queue predicate logic.
2. Add topbar controls.
3. Add Playwright coverage for a critical/SLA/low-confidence workflow.
4. Later, add saved views and group filters if needed.

## Success Metrics

- Queue can filter by priority, SLA risk, and AI confidence.
- Existing status and search filters still work.
- Mobile queue has no horizontal overflow.
- Frontend lint, build, and E2E pass.

## Risks And Mitigations

- Multiple filters can hide all tickets. Mitigate with existing empty state.
- Topbar can crowd on small screens. Mitigate with flex wrap and full-width controls on mobile.
- Low-confidence threshold can be debated. Mitigate by using the governance threshold already used for low-confidence AI: below 72%.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Add client-side operational queue filters.

## Open Questions

- Should the next cycle add group and assignee filters from the service catalog?
- Should analysts be able to save named queue views?
