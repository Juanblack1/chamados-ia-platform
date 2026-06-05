---
status: completed
title: Update Playwright frontend reuse policy
type: test
complexity: low
dependencies: []
---

# Task 1: Update Playwright frontend reuse policy

## Requirements

- Frontend webServer SHOULD reuse an existing local server outside CI.
- Backend webServer MUST continue starting fresh.
- Ports and environment variables MUST remain unchanged.

## Subtasks

- [x] 1.1 Change frontend `reuseExistingServer`.
- [x] 1.2 Confirm backend policy stays false.

## Tests

- [x] Playwright config compiles through E2E.
