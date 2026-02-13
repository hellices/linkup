# Implementation Plan: Pin Text Preview

**Branch**: `004-pin-text-preview` | **Date**: 2026-02-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-pin-text-preview/spec.md`

## Summary

Add truncated text snippets to map pins so users can glance at post content without tapping. **Solo pins** show ~40 characters of the post text below the speech bubble. **Cluster markers** show the newest post's snippet plus a "+N more" label, replacing the plain count badge. An **occlusion avoidance** pass hides snippets whose bounding boxes would overlap nearby pins or other snippets, keeping the map readable at moderate density. All logic lives in `MapView.tsx` within the existing `buildSpeechBubbleHtml()` / `buildClusterHtml()` / `renderMarkers()` pipeline. No new files, API endpoints, or database changes required.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js (Next.js 14 SSR)
**Primary Dependencies**: `azure-maps-control` ^3.7.2 (HtmlMarker rendering), `react` ^18.3.1, `next` ^14.2.35
**Storage**: N/A — no storage changes; reads existing `PostSummary.text` field
**Testing**: Manual E2E via `npm run dev`; `npx tsc --noEmit` for type-checking
**Target Platform**: Next.js 14 client-side (MapView component), Windows dev / Linux deploy
**Project Type**: Web (Next.js monolith)
**Performance Goals**: Pin rendering at 60fps for up to 200 markers with snippets; no perceptible jank during zoom transitions that trigger cluster/solo state changes
**Constraints**: No new npm dependencies; snippet width ≤ 120px to avoid overlap with nearby pins; snippet text truncated at ~40 characters with ellipsis; must preserve existing search highlight/dim and clustering behavior; occlusion check uses grid-based spatial index (same cell size as clustering) for O(n·k) efficiency
**Scale/Scope**: ~1 modified file (`MapView.tsx`), 0 new files, 0 API changes, 0 DB changes; adds ~80 lines (truncation helper, occlusion pass, cluster snippet rendering)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| 1.1 | Lightweight by Design | PASS | Adds passive text preview — zero additional user interaction required; reduces taps needed to browse content |
| 1.2 | Map-First Interaction | PASS | Enhancement is entirely map-centric — snippets appear on map pins |
| 1.3 | Connection Over Storage | PASS | No new storage; reading existing post text for display-only preview |
| 2.1 | Mandatory TTL | PASS | TTL behavior unchanged; snippet disappears when post expires |
| 2.2 | Optional De-identified Summary | PASS | N/A — no summary changes |
| 3.1 | Entra ID Authentication Only | PASS | Auth flow unchanged |
| 3.2 | Minimum-Privilege Principle | PASS | No new permissions or API scopes |
| 3.3 | Zero Sensitive Data | PASS | Displays already-visible post text in truncated form on the map |
| 4.1 | MCP as a Core Capability | PASS | MCP server and tools unchanged |
| 4.2 | Multi-source Knowledge Access | PASS | N/A |
| 4.3 | Transparency | PASS | N/A |
| 5.1 | Intent-based Participation | PASS | Engagement flow unchanged; clicking a snippet opens the same PostPopup |
| 5.2 | No Heavy Social Graph | PASS | No social features added |
| 6.1–6.4 | Rewards & Reputation | PASS | N/A |
| 6.4 | Lightweight Visualization | PASS | Snippet is a small, subtle text label — not a heavy visual effect; hides when map is dense (clustering) |
| 7.1 | Modular Architecture | PASS | Change is contained within the existing `buildSpeechBubbleHtml()` function and `renderMarkers()` callback — no architectural changes |
| 7.2 | Observability | PASS | No new logging requirements |
| 8.1 | Spec-Driven Flow | PASS | Following spec → plan → tasks flow |
| 8.2 | Copilot Usage Documentation | PASS | Will document in copilot-notes.md |
| 8.3 | MVP First | PASS | Minimal scope — one function change, one file, zero dependencies |
| 8.4 | English-Only Policy | PASS | All artifacts in English |

**Gate Result**: ALL PASS — no violations. Proceeding to Phase 0.

**Post-Design Re-check (Phase 1)**: ALL PASS — no new violations introduced. Lightweight Visualization (6.4) confirmed: snippet is a small 11px text label that auto-hides when map density increases (clustering). Modular Architecture (7.1) maintained: all changes stay within the existing `buildSpeechBubbleHtml()` rendering function and `renderMarkers()` callback — no architectural changes.

## Project Structure

### Documentation (this feature)

```text
specs/004-pin-text-preview/
├── plan.md              # This file
├── research.md          # Phase 0 output — HtmlMarker text rendering, CSS truncation
├── data-model.md        # Phase 1 output — No new entities; documents snippet derivation
├── quickstart.md        # Phase 1 output — Setup & verification instructions
├── contracts/           # Phase 1 output — No API changes (N/A)
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── components/
│   └── MapView.tsx            # MODIFIED: (1) Add truncateSnippet() helper
│                              #           (2) Modify buildSpeechBubbleHtml() to render snippet text below tail
│                              #           (3) Modify buildClusterHtml() to render newest-post snippet + "+N more" label
│                              #           (4) Add occlusion avoidance pass in renderMarkers() to hide overlapping snippets
│                              #           (5) Handle snippet dimming/hiding in search-highlight branch
└── types/
    └── index.ts               # UNCHANGED: PostSummary.text already available
```

**Structure Decision**: Next.js monolith (web). All changes within the single existing file `app/components/MapView.tsx`. The `buildSpeechBubbleHtml()` function gains a `snippetText` parameter; `buildClusterHtml()` gains `snippetText` and `moreCount` parameters; the `renderMarkers()` callback passes truncated text for solo and cluster pins, then runs an occlusion pass to selectively hide snippets whose bounding boxes would collide. No new files or directories created.

## Complexity Tracking

No constitution violations to justify.
