---
status: completed
title: Remove frontend encoding artifacts
type: frontend
complexity: low
dependencies: []
---

# Task 1: Remove frontend encoding artifacts

## Requirements

- SLA policy copy MUST NOT contain mojibake artifacts.
- SLA badge copy MUST NOT contain mojibake artifacts.
- Copy MUST remain concise for dense operational scanning.

## Subtasks

- [x] 1.1 Replace corrupted SLA policy separator.
- [x] 1.2 Replace corrupted SLA badge separator.
- [x] 1.3 Search frontend source for residual artifacts.

## Tests

- [x] Artifact search finds no frontend matches.
