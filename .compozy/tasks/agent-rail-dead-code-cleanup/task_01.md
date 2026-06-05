---
status: completed
title: Remove unused AgentRail UI code
type: frontend
complexity: low
dependencies: []
---

# Task 1: Remove unused AgentRail UI code

## Requirements

- `AgentRail` MUST be removed from source.
- Imports used only by `AgentRail` MUST be removed.
- Dedicated unused styles SHOULD be removed when confirmed unused.

## Subtasks

- [x] 1.1 Confirm `AgentRail` has no consumers.
- [x] 1.2 Delete the component.
- [x] 1.3 Remove unused imports.
- [x] 1.4 Remove dedicated dead CSS selectors.

## Tests

- [x] Frontend lint passes.
