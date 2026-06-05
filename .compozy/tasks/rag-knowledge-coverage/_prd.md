# PRD: RAG Knowledge Coverage & Catalog Alignment

## Problem

Service Desk IA already cites RAG evidence in tickets, but the administrative catalog is not aligned with the source ids used by RAG retrieval. This weakens governance because analysts cannot easily answer whether cited evidence is cataloged, fresh, owned by a group, or leaving service gaps.

## Goals

- Align catalog knowledge article ids with actual RAG source ids.
- Add basic ownership and review metadata to catalog articles.
- Show RAG knowledge health in the governance dashboard.
- Surface uncataloged sources, stale articles, heavily used sources, and services with missing RAG evidence.

## Non-Goals

- No full knowledge article CRUD.
- No Qdrant write pipeline.
- No external CMS integration.
- No historical analytics warehouse.

## Users

- Managers and admins monitoring AI governance.
- Analysts reviewing evidence behind AI decisions.

## Requirements

- The catalog MUST include every seeded RAG source id.
- Governance MUST show source coverage for active tickets.
- Governance MUST show sources used without catalog match.
- Governance MUST show stale knowledge articles based on review cadence.
- Governance MUST remain useful when there are no tickets or no catalog entries.
- The UI MUST stay dense, operational, and consistent with the existing product register.

## Success Metrics

- Admin can see "Saude da base RAG" from the governance view.
- At least one automated test verifies catalog and retrieved source alignment.
- E2E smoke verifies the governance knowledge panel is visible.
