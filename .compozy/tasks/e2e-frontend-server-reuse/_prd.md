# E2E Frontend Server Reuse PRD

## Overview

Repeated local Playwright runs often fail before executing tests because the Vite frontend server remains on port `5174`. The current config sets `reuseExistingServer: false` for both backend and frontend, forcing a hard failure when a residual frontend process exists.

## Goals

- Make repeated local E2E runs reliable when the frontend dev server is already listening.
- Keep backend test isolation by starting a fresh backend server for each Playwright run.
- Preserve the current ports, base URL and test environment.

## User Stories

- As a developer, I want `npm run test:e2e` to run repeatedly without manually killing Vite.
- As a tester, I want backend state to remain isolated between runs.
- As a maintainer, I want the Playwright config to document the local/CI tradeoff.

## Core Features

- Enable frontend `reuseExistingServer` outside CI.
- Keep backend `reuseExistingServer` disabled.
- Verify E2E works after the config change.

## Non-Goals

- No test flow changes.
- No port changes.
- No backend storage changes.
- No CI behavior loosening.

## Success Metrics

- Playwright can reuse an existing local frontend server.
- Backend still starts fresh for the E2E environment.
- E2E, frontend build and Compozy validation pass.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Reuse only the frontend dev server for local E2E runs.
