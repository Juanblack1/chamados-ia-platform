---
status: completed
title: Make frontend E2E startup deterministic
type: test
complexity: low
dependencies: []
---

# Task 1: Make frontend E2E startup deterministic

## Requirements

- E2E frontend default port SHOULD be dedicated to this project.
- Frontend webServer MUST NOT reuse arbitrary existing servers.
- Vite SHOULD fail fast when the dedicated port is occupied.

## Subtasks

- [x] 1.1 Change default E2E frontend port.
- [x] 1.2 Add Vite strict port flag.
- [x] 1.3 Disable frontend server reuse.

## Tests

- [x] Playwright config runs E2E against the expected app.
