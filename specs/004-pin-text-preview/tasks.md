# Tasks: Pin Text Preview

**Input**: Design documents from `/specs/004-pin-text-preview/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. All tasks modify the single file `app/components/MapView.tsx`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- File path: `app/components/MapView.tsx` for all implementation tasks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the shared `truncateSnippet()` helper function used by all user stories

- [x] T001 Add `truncateSnippet()` helper function in `app/components/MapView.tsx` — word-boundary truncation at ~40 characters with "…" ellipsis, whitespace normalization via `replace(/\s+/g, " ").trim()`, hard-cut fallback for long words without spaces (per research Q4)

**Checkpoint**: Helper function exists and can be called; no visible changes yet.

---

## Phase 2: User Story 1 — Glanceable Post Preview on Solo Pins (Priority: P1) 🎯 MVP

**Goal**: Solo (non-clustered) pins show a truncated text snippet below the speech-bubble tail so users can read post content at a glance.

**Independent Test**: Seed map with several non-overlapping posts → each solo pin displays truncated text below the bubble.

### Implementation for User Story 1

- [x] T002 [US1] Add `snippetText` parameter to `buildSpeechBubbleHtml()` in `app/components/MapView.tsx` — append a `<div>` with inline styles (`max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:#374151; text-align:center; line-height:1.2; margin-top:2px; pointer-events:none`) below the tail triangle; only render if `snippetText` is non-empty; inherit `opacity` from the pin's opacity parameter (per research Q2, Q3)
- [x] T003 [US1] Update solo-pin branch in `renderMarkers()` in `app/components/MapView.tsx` — call `truncateSnippet(post.text)` and pass the result as `snippetText` to `buildSpeechBubbleHtml()`; for non-dimmed solo pins, pass the truncated text; for dimmed pins, pass empty string (snippet hidden)

**Checkpoint**: Solo pins show text snippets. Clusters still show count-only badges. No occlusion handling yet.

---

## Phase 3: User Story 2 — Cluster Snippet Preview (Priority: P2)

**Goal**: Cluster markers show the newest post's snippet + "+N more" label below the count badge, so users can preview cluster content at a glance.

**Independent Test**: Create 3+ posts at the same location → cluster marker shows newest post's snippet and "+2 more".

### Implementation for User Story 2

- [x] T004 [US2] Add `snippetText` and `moreCount` parameters to `buildClusterHtml()` in `app/components/MapView.tsx` — after the existing count badge circle, append a snippet `<div>` (same inline styles as solo snippet: `max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:#374151; text-align:center; margin-top:4px`) and a "+N more" `<div>` (`font-size:10px; color:#9ca3af; font-style:italic; text-align:center; margin-top:1px`); hide both when `isDimmed` is true; hide "+N more" when `moreCount` is 0 (per research Q6)
- [x] T005 [US2] Update cluster branch in `renderMarkers()` in `app/components/MapView.tsx` — sort `clusterMembers` by `createdAt` descending, take `sorted[0].text` through `truncateSnippet()`, compute `moreCount = sorted.length - 1`, pass both to `buildClusterHtml()`

**Checkpoint**: Clusters show newest-post snippet + "+N more". Solo pins show snippets. No occlusion handling yet.

---

## Phase 4: User Story 3 — Snippet Occlusion Avoidance (Priority: P3)

**Goal**: When nearby solo pins' snippets would overlap each other or a neighboring pin, the system hides the older pin's snippet to keep the map readable.

**Independent Test**: Create two posts ~80px apart on screen → only the newer post's snippet is shown if they would overlap; zooming in reveals both.

### Implementation for User Story 3

- [x] T006 [US3] Add `SnippetRect` interface and `rectsOverlap()` utility function in `app/components/MapView.tsx` — `SnippetRect` has `left`, `top`, `right`, `bottom` number fields; `rectsOverlap(a, b)` returns true if two rects intersect (per research Q7)
- [x] T007 [US3] Add `computeSnippetVisibility()` function in `app/components/MapView.tsx` — accepts array of `{ post: PostSummary; px: number; py: number }` (solo pins with pixel positions) and array of `SnippetRect` (cluster bounding boxes); sorts solo pins newest-first by `createdAt`; seeds occupied rects with cluster rects and all pin bubble rects `[px-24, py-36, px+24, py+8]`; greedily assigns snippet visibility using estimated snippet rect `[px-60, py+22, px+60, py+40]`; returns `Set<string>` of post IDs whose snippets should be shown (per research Q7)
- [x] T008 [US3] Integrate occlusion pass into `renderMarkers()` in `app/components/MapView.tsx` — after `computeClusters()`, collect solo-pin pixel positions and cluster bounding boxes; call `computeSnippetVisibility()`; when creating solo-pin markers, only pass `snippetText` to `buildSpeechBubbleHtml()` if the post ID is in the visible set; otherwise pass empty string

**Checkpoint**: Overlapping snippets are hidden (newest wins). All solo & cluster snippets render correctly.

---

## Phase 5: User Story 4 — Snippet Respects Search Dimming (Priority: P4)

**Goal**: Dimmed pins (search non-matches) hide their text snippets to maintain visual hierarchy.

**Independent Test**: Perform a search → dimmed pins have no visible snippet; matched pins show snippets at full opacity.

### Implementation for User Story 4

- [x] T009 [US4] Update solo-pin dimming logic in `renderMarkers()` in `app/components/MapView.tsx` — when `isDimmed` is true, pass empty string as `snippetText` to `buildSpeechBubbleHtml()` so no snippet is rendered on dimmed pins; dimmed pins should also be excluded from the `computeSnippetVisibility()` input (they don't occupy snippet space)
- [x] T010 [US4] Update cluster dimming logic in `renderMarkers()` in `app/components/MapView.tsx` — when cluster `isDimmed` (all posts are non-matching), pass empty string as `snippetText` and `0` as `moreCount` to `buildClusterHtml()`; when cluster `isHighlighted` (some match), show snippet at full opacity

**Checkpoint**: Search dimming works for both solo pins and cluster snippets. All four user stories are complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Type safety, documentation, and quickstart validation

- [x] T011 Run `npx tsc --noEmit` and fix any TypeScript errors in `app/components/MapView.tsx`
- [x] T012 Update `docs/copilot-notes.md` with feature 004 implementation notes
- [x] T013 Run `npm run dev` and validate all 7 quickstart verification steps from `specs/004-pin-text-preview/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — `truncateSnippet()` helper stands alone
- **Phase 2 (US1)**: Depends on Phase 1 — needs `truncateSnippet()`
- **Phase 3 (US2)**: Depends on Phase 1 — needs `truncateSnippet()`; independent of US1
- **Phase 4 (US3)**: Depends on Phase 2 — needs solo-pin snippet rendering to be in place before occlusion logic can be applied
- **Phase 5 (US4)**: Depends on Phase 2 and Phase 3 — dimming logic applies to both solo and cluster snippets
- **Phase 6 (Polish)**: Depends on all user stories being complete

### User Story Independence

- **US1 (P1)** and **US2 (P2)** are independent of each other — both only depend on Phase 1
- **US3 (P3)** depends on US1 (needs solo-pin snippets to exist before occlusion makes sense)
- **US4 (P4)** depends on US1 and US2 (dimming applies to both solo and cluster snippets)

### Within-File Conflict Note

All tasks modify the same file (`MapView.tsx`). Tasks marked `[P]` within the same phase have no code-region conflicts (they touch different functions), but cross-phase tasks MUST be sequential because later phases depend on code added by earlier phases.

### Parallel Opportunities

Since all changes are in a single file, true parallelism is limited. However:

- **T002 and T004 could be developed in parallel** (they modify different functions: `buildSpeechBubbleHtml` vs `buildClusterHtml`), then merged in sequence into `renderMarkers()`
- **T006 and T007 are purely additive** (new functions) and could be written in parallel before T008 integrates them

---

## Parallel Example: User Story 1 + User Story 2

```bash
# These touch different functions and can be developed in parallel:
T002: Add snippetText param to buildSpeechBubbleHtml()  # solo pin function
T004: Add snippetText + moreCount params to buildClusterHtml()  # cluster function

# Then integrate sequentially in renderMarkers():
T003: Wire solo-pin snippet in renderMarkers()
T005: Wire cluster snippet in renderMarkers()
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 (truncateSnippet helper)
2. Complete T002–T003 (solo pin snippets)
3. **STOP and VALIDATE**: Solo pins show text previews
4. This alone delivers the core value — users can read post content at a glance

### Incremental Delivery

1. T001 → Helper ready
2. T002–T003 → Solo snippets visible (MVP!) → validate via quickstart steps 1–2
3. T004–T005 → Cluster previews visible → validate via quickstart step 3
4. T006–T008 → Occlusion avoidance active → validate via quickstart step 6
5. T009–T010 → Search dimming works → validate via quickstart step 4
6. T011–T013 → Polish, type-check, docs, full quickstart validation
