# UI Copy Encoding Polish PRD

## Overview

Some SLA labels still render with mojibake separators such as `Â·`. In a service desk tool, broken copy in operational indicators weakens trust in the interface and makes the product feel less reliable.

## Goals

- Remove visible encoding artifacts from SLA and admin policy copy.
- Keep the existing information density and layout.
- Preserve ASCII-safe source text for stable rendering across terminals and browsers.

## User Stories

- As an analyst, I want SLA labels to read cleanly while scanning tickets.
- As an admin, I want SLA policy summaries to look professional and consistent.
- As a maintainer, I want a simple check that prevents encoding artifacts from remaining in the frontend source.

## Core Features

- Replace corrupted middle-dot separators with an ASCII-safe separator.
- Verify no `Â` or `Ã` artifacts remain in frontend source.
- Run frontend verification after the copy polish.

## Non-Goals

- No visual redesign.
- No translation overhaul.
- No API or data-model changes.

## Success Metrics

- `rg "Ã|Â"` finds no matches in `frontend/src`.
- Frontend lint and build pass.
- Compozy task validation passes.

## Architecture Decision Records

- [ADR-001](adrs/adr-001.md): Use ASCII-safe separators for operational copy.
