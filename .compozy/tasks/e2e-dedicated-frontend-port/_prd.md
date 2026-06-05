# E2E Dedicated Frontend Port PRD

## Overview

The local E2E config can reuse any server listening on the frontend port. A failed run showed Playwright testing an unrelated app on `5174`, causing the login fields for Chamados-ia to be absent. The suite must never pass or fail against the wrong frontend.

## Goals

- Give E2E a dedicated default frontend port.
- Disable automatic reuse of arbitrary existing frontend servers.
- Fail fast on port conflicts instead of testing the wrong app.

## User Stories

- As a developer, I want `npm run test:e2e` to target Chamados-ia every time.
- As a maintainer, I want port collisions to be explicit failures, not misleading UI timeouts.
- As a tester, I want the backend `FRONTEND_ORIGIN` and Playwright `baseURL` to stay aligned.

## Core Features

- Move E2E frontend default port away from generic Vite port `5174`.
- Start Vite with `--strictPort`.
- Set frontend `reuseExistingServer` to `false`.

## Non-Goals

- No E2E flow changes.
- No backend behavior changes.
- No production dev-server script changes.

## Success Metrics

- Playwright no longer reuses unrelated apps on `5174`.
- E2E passes against the dedicated frontend server.
- Compozy task validation passes.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Prefer deterministic E2E frontend startup over server reuse.
