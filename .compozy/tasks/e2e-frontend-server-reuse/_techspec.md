# E2E Frontend Server Reuse TechSpec

## Executive Summary

Update `playwright.config.ts` so the frontend web server uses `reuseExistingServer: !process.env.CI`. This solves recurring local failures caused by a residual Vite server on port `5174`. The backend remains `reuseExistingServer: false` to avoid leaking in-memory tickets and users between test runs.

## Scope

- Update frontend webServer reuse policy.
- Keep backend webServer reuse policy unchanged.
- Run E2E at least once after the change.
- Run frontend build to ensure config changes do not break compilation.

## System Design

Backend webServer:

```ts
reuseExistingServer: false
```

Frontend webServer:

```ts
reuseExistingServer: !process.env.CI
```

In CI, Playwright still fails on occupied ports. Locally, Playwright can attach to the existing Vite server.

## Testing Strategy

- Run `npm.cmd run test:e2e`.
- Run `npm.cmd --workspace frontend run build`.
- Validate task metadata.

## Development Sequencing

1. Update Playwright config.
2. Run E2E.
3. Run build.
4. Validate metadata and update tasks.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Reuse only the frontend dev server for local E2E runs.
