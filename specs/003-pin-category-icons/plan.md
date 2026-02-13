# Implementation Plan: Pin Category Icons & Clustering

**Branch**: `003-pin-category-icons` | **Date**: 2026-02-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-pin-category-icons/spec.md`

## Summary

Add category-based pin classification and overlapping pin clustering to the LinkUp map. Users select a collaboration type (question, discussion, share, help, meetup) when creating a post, and the map pin is rendered as a speech-bubble marker with a distinct emoji and color per category. Overlapping pins are merged into cluster markers with numeric badges; clicking a cluster opens a chronological list panel for post selection. Implementation uses CSS border-trick speech bubbles in `atlas.HtmlMarker`, Azure Maps `DataSource` with built-in `cluster: true` for proximity grouping, and manual HtmlMarker management on top of the DataSource clustering output.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js (Next.js 14 SSR)
**Primary Dependencies**: `azure-maps-control` ^3.7.2 (existing — speech-bubble HtmlMarkers + DataSource clustering), `react` ^18.3.1, `next` ^14.2.35, `better-sqlite3` ^12.6.2, `zod` ^4.3.6
**Storage**: SQLite via `better-sqlite3` — `category TEXT` column added to `posts` table
**Testing**: Manual E2E via `npm run dev`; `npx tsc --noEmit` for type-checking
**Target Platform**: Next.js 14 server-side (API routes, SSR), Windows dev / Linux deploy
**Project Type**: Web (Next.js monolith — no separate backend/frontend projects)
**Performance Goals**: Pin rendering at 60fps for up to 200 markers; cluster list panel opens within 200ms; category selection adds <1s to post creation flow
**Constraints**: No new npm dependencies; speech-bubble pins ≥32px (FR-011); cluster proximity threshold configurable via `clusterRadius`; must preserve existing search highlight/dim behavior
**Scale/Scope**: ~3 modified files, ~2 new files, 1 DB migration (ALTER TABLE); 0 new API endpoints (clustering is client-side)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| 1.1 | Lightweight by Design | PASS | Category selector is a single-tap button group (≤3s per spec SC-001); no multi-step wizard |
| 1.2 | Map-First Interaction | PASS | All changes are map-centric — pins, clustering, and spatial interaction |
| 1.3 | Connection Over Storage | PASS | Category is a lightweight metadata field; no new storage paradigm |
| 2.1 | Mandatory TTL | PASS | TTL behavior unchanged; cluster dissolves when posts expire |
| 2.2 | Optional De-identified Summary | PASS | N/A — no summary changes |
| 3.1 | Entra ID Authentication Only | PASS | Auth flow unchanged; category is added to existing authenticated POST |
| 3.2 | Minimum-Privilege Principle | PASS | No new permissions or API scopes |
| 3.3 | Zero Sensitive Data | PASS | Category is non-sensitive metadata |
| 4.1 | MCP as a Core Capability | PASS | MCP server and tools unchanged |
| 4.2 | Multi-source Knowledge Access | PASS | N/A |
| 4.3 | Transparency | PASS | N/A |
| 5.1 | Intent-based Participation | PASS | Engagement flow unchanged; cluster list leads to same PostPopup |
| 5.2 | No Heavy Social Graph | PASS | No social features added |
| 6.1–6.4 | Rewards & Reputation | PASS | N/A |
| 7.1 | Modular Architecture | PASS | Category definitions in separate `categories.ts`; ClusterListPanel is a new component; server logic stays in API route |
| 7.2 | Observability | PASS | No new logging requirements; existing structured logs preserved |
| 8.1 | Spec-Driven Flow | PASS | Following spec → plan → tasks flow |
| 8.2 | Copilot Usage Documentation | PASS | Will document in copilot-notes.md |
| 8.3 | MVP First | PASS | Scoped to 5 fixed categories + simple proximity clustering; no advanced features |
| 8.4 | English-Only Policy | PASS | All artifacts in English |

**Gate Result**: ALL PASS — no violations. Proceeding to Phase 0.

**Post-Design Re-check (Phase 1)**: ALL PASS — no new violations introduced. Lightweight by Design (1.1) confirmed: category selector is a 5-button group matching the existing TTL selector pattern. Modular Architecture (7.1) maintained: new `categories.ts` constant file + `ClusterListPanel` component keep concerns separated.

## Project Structure

### Documentation (this feature)

```text
specs/003-pin-category-icons/
├── plan.md              # This file
├── research.md          # Phase 0 output — Azure Maps clustering, speech-bubble styling
├── data-model.md        # Phase 1 output — Post.category field, CategoryDefinition
├── quickstart.md        # Phase 1 output — Setup & verification instructions
├── contracts/           # Phase 1 output — OpenAPI changes (category field)
│   └── openapi.yaml     # Modified CreatePostRequest, Post, PostSummary schemas
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── lib/
│   ├── categories.ts          # NEW: Category definitions (emoji, label, colors)
│   ├── db.ts                  # MODIFIED: Add category column + ALTER TABLE migration
│   └── validation.ts          # MODIFIED: Add category validation
├── api/
│   └── posts/
│       └── route.ts           # MODIFIED: Accept + validate category in POST, return in GET
├── components/
│   ├── MapView.tsx            # MODIFIED: Speech-bubble pins, DataSource clustering, cluster markers
│   ├── ClusterListPanel.tsx   # NEW: Chronological post list panel for cluster click
│   ├── PostCreateModal.tsx    # MODIFIED: Add category selector button group
│   └── PostPopup.tsx          # MODIFIED: Display category emoji + label
└── types/
    └── index.ts               # MODIFIED: Add PostCategory type, category field to Post/CreatePostRequest
```

**Structure Decision**: Next.js monolith (web). All changes within the existing `app/` directory structure. Two new files (`categories.ts`, `ClusterListPanel.tsx`) follow existing patterns. No new directories created.

## Complexity Tracking

No constitution violations to justify.
