# Targeted Ticket Assignment PRD

## Overview

The platform can show workload by group and technician, but the treatment workflow only exposes "assign to me". The backend route already accepts `assigneeId`, yet it currently ignores the value. Enable authorized managers and analysts to assign a ticket to an eligible technician in the ticket's group.

## Goals

- Let workers assign a ticket to themselves or another eligible technician.
- Keep assignment constrained by entity, permissions, and assigned group.
- Surface eligible technicians in the treatment workspace.
- Preserve existing self-assignment behavior.

## User Stories

- As a manager, I want to assign an ERP ticket to an ERP technician so I can rebalance work.
- As an analyst, I want to take a ticket quickly with the existing self-assign action.
- As an administrator, I want the API to reject assignment to requesters or unrelated groups.

## Core Features

- Backend resolves optional `assigneeId` from the auth store.
- Orchestrator validates target assignment scope.
- API client accepts optional `assigneeId`.
- Treatment workspace renders an assignee selector for eligible users.
- E2E verifies assignment to a named technician.

## Non-Goals

- No bulk assignment.
- No drag-and-drop queue routing.
- No historical capacity forecast.
- No notification delivery.

## UX Requirements

- Assignment controls must remain compact in the treatment header.
- Self-assignment must stay one click.
- Technician selector must show only users who can work the ticket's group.
- Current assignee must be visible in the select.

## Success Metrics

- Assigning to a compatible technician returns the updated ticket.
- Assigning to an incompatible technician is rejected.
- Treatment workspace shows the selected technician after assignment.
- Backend tests, frontend lint/build, E2E, and task validation pass.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Validate targeted assignment in the orchestrator.
