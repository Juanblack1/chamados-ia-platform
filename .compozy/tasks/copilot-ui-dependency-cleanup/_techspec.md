# Copilot UI Dependency Cleanup TechSpec

## Executive Summary

Use npm workspace dependency removal to drop the unused direct `@copilotkit/react-ui` package from the frontend manifest and lockfile. The app already imports `CopilotKit` and `CopilotPopup` from `@copilotkit/react-core/v2`, so runtime behavior should remain unchanged.

## Scope

- Remove `@copilotkit/react-ui` from the frontend workspace dependencies.
- Verify source does not import `@copilotkit/react-ui`.
- Run frontend lint, build and E2E.
- Validate task metadata.

## System Design

Current code remains:

```tsx
import { CopilotKit, CopilotPopup } from "@copilotkit/react-core/v2";
```

The package graph should stop advertising the legacy UI package as a direct frontend dependency. If npm retains it transitively, that is acceptable; the application manifest should still express only what it imports.

## Testing Strategy

- Run `rg "@copilotkit/react-ui" frontend/src frontend/package.json`.
- Run `npm.cmd --workspace frontend run lint`.
- Run `npm.cmd --workspace frontend run build`.
- Run `npm.cmd run test:e2e`.
- Validate Compozy metadata.

## Development Sequencing

1. Remove the direct dependency with npm workspace tooling.
2. Confirm source and manifest no longer reference it.
3. Run lint, build and E2E.
4. Update task tracking and validate metadata.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Prefer Copilot v2 exports from React Core.
