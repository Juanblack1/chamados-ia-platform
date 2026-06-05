---
status: completed
title: Align backend knowledge catalog
type: backend
complexity: low
dependencies: []
---

# Task 1: Align backend knowledge catalog

## Overview

Make the service desk catalog use the same knowledge article ids that RAG evidence uses in tickets.

<requirements>
- Catalog article ids MUST match seeded RAG source ids.
- Catalog articles MUST include ownership and review metadata.
- Backend integration coverage MUST prove ticket source ids are cataloged.
</requirements>

## Subtasks

- [x] 1.1 Extend catalog article type.
- [x] 1.2 Align article ids and metadata.
- [x] 1.3 Add backend integration coverage.

## Relevant Files

- `backend/src/domain/serviceDeskCatalog.ts`
- `backend/src/ai/rag/knowledgeSeed.ts`
- `backend/tests/api.integration.test.ts`

## Tests

- [x] Backend integration verifies retrieved source ids exist in catalog.
