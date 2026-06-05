# Queue Workload Balancing PRD

## Overview

The queue now supports operational filters, but managers still cannot quickly see whether work is concentrated in a single group, a technician, or unassigned backlog. Add a queue workload panel that summarizes active demand by owning group and assignee using the tickets already loaded for the current user.

## Goals

- Expose group workload, SLA risk, critical volume, low-confidence AI volume, and unassigned backlog.
- Help managers decide where to rebalance work before SLA rescue becomes reactive.
- Keep the view dense and useful for a service desk operator.
- Avoid backend scope in this cycle.

## User Stories

- As a manager, I want to see active workload by group so I can identify overloaded teams.
- As a lead analyst, I want to see unassigned work per group so I can distribute tickets.
- As a governance operator, I want low-confidence AI volume next to workload so I can route reviews.
- As a technician, I want to see who is carrying active tickets without opening every record.

## Core Features

- Queue shows a workload panel below the metric strip.
- Group rows show active tickets, critical tickets, SLA attention, low-confidence tickets, and unassigned tickets.
- Assignee rows show active ticket counts and current SLA/critical pressure.
- The panel uses active tickets only, excluding resolved and closed tickets.
- Empty states explain when no active workload exists.

## Non-Goals

- No drag-and-drop assignment.
- No server-side analytics endpoint.
- No historical staffing trends.
- No individual performance scoring.

## UX Requirements

- The panel must be compact and readable beside the queue table.
- Labels must use operational Portuguese.
- Rows must not overflow on mobile.
- The visual treatment must align with the existing internal-tool design system.

## Success Metrics

- Managers can identify the most loaded group without opening details.
- Unassigned active tickets are visible at group level.
- Low-confidence AI workload is visible at group level.
- Frontend lint, build, E2E, and task validation pass.

## Risks And Mitigations

- Risk: Workload counts could be mistaken for staffing performance. Mitigate with neutral labels and no ranking language beyond count ordering.
- Risk: The queue can become visually crowded. Mitigate with one compact panel and capped row counts.
- Risk: Users may expect assignment actions from the panel. Mitigate by keeping this cycle read-only and linking row context to existing table selection later.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Add a client-side workload panel to the queue.
