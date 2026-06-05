# E2E Dedicated Frontend Port TechSpec

## Executive Summary

Update `playwright.config.ts` so the frontend web server defaults to a project-specific E2E port and does not reuse existing servers. Vite should start with `--strictPort`, making a port collision fail before tests run.

## Scope

- Change default `E2E_FRONTEND_PORT`.
- Add `--strictPort` to the frontend webServer command.
- Set frontend `reuseExistingServer` to `false`.
- Run E2E.

## System Design

The backend still starts fresh with in-memory state. The frontend also starts fresh on a dedicated port:

```ts
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "53174";
reuseExistingServer: false
```

Vite command:

```sh
npm --workspace frontend run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort
```

## Testing Strategy

- Run `npm.cmd run test:e2e`.
- Validate task metadata.

## Development Sequencing

1. Update Playwright frontend port and reuse policy.
2. Run E2E.
3. Update task tracking and validate metadata.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Prefer deterministic E2E frontend startup over server reuse.
