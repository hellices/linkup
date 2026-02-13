# Tasks: Pin Category Icons & Clustering

**Input**: Design documents from `/specs/003-pin-category-icons/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Shared types, constants, and database changes that all user stories depend on.

- [x] T001 [P] Add `PostCategory` type and `category` field to `Post`, `PostSummary`, and `CreatePostRequest` interfaces in `app/types/index.ts`
- [x] T002 [P] Create category definitions constant file with emoji, label, colors per category in `app/lib/categories.ts`
- [x] T003 Add `category` column to posts table schema and ALTER TABLE migration for existing databases in `app/lib/db.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Server-side validation and API changes that MUST be complete before any UI work.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Add `validateCategory` function accepting optional category string and returning validated value or default in `app/lib/validation.ts`
- [x] T005 Update POST handler to accept `category` field from request body, validate via `validateCategory`, persist to DB, and return in response in `app/api/posts/route.ts`
- [x] T006 Update GET handler to include `category` field (with COALESCE default `'discussion'` for legacy rows) in query results in `app/api/posts/route.ts`

**Checkpoint**: API accepts and returns `category` field — all endpoints backward-compatible.

---

## Phase 3: User Story 1 — Post Creation with Category Selection (Priority: P1) MVP

**Goal**: Users can select a post category (question, discussion, share, help, meetup) in the creation modal. Default is "discussion". Selected category is saved and reflected on the map pin.

**Independent Test**: Sign in → "+" button → select a category → enter text + TTL → save → verify marker shows selected category emoji.

### Implementation for User Story 1

- [x] T007 [US1] Add category selector button group UI (5 buttons: emoji + label, single-select, default "discussion" pre-selected) to `app/components/PostCreateModal.tsx`
- [x] T008 [US1] Wire category state to POST request body, sending selected category value in fetch call in `app/components/PostCreateModal.tsx`
- [x] T009 [US1] Update modal heading to show selected category emoji dynamically in `app/components/PostCreateModal.tsx`

**Checkpoint**: User Story 1 complete — category selection flows from modal → API → database → response.

---

## Phase 4: User Story 2 — Differentiated Pin Display by Category (Priority: P1) MVP

**Goal**: Map pins are rendered as speech-bubble markers with category-specific emoji and color. Each of the 5 categories is visually distinguishable at a glance.

**Independent Test**: Create 3+ posts with different categories → verify each appears as a speech-bubble pin with distinct emoji/color.

### Implementation for User Story 2

- [x] T010 [US2] Create `buildSpeechBubbleHtml` helper function that generates speech-bubble HtmlMarker HTML string from category, returning CSS border-trick tail + rounded body with parameterized emoji and color in `app/components/MapView.tsx`
- [x] T011 [US2] Replace existing circular marker rendering with speech-bubble markers using `buildSpeechBubbleHtml` and category data from post in `app/components/MapView.tsx`
- [x] T012 [US2] Update search highlight/dim logic to preserve category emoji while applying orange highlight color or dimmed opacity, using category color for non-search state in `app/components/MapView.tsx`
- [x] T013 [US2] Set HtmlMarker `pixelOffset` to `[0, -28]` so speech-bubble tail tip aligns with geographic coordinate in `app/components/MapView.tsx`

**Checkpoint**: User Story 2 complete — all pins show category-specific speech-bubble markers with correct search highlight coexistence.

---

## Phase 5: User Story 3 — Category Display in Post Popup (Priority: P2)

**Goal**: Post popup shows the category emoji + label so users can confirm the post type after clicking a marker.

**Independent Test**: Click a post marker → verify popup shows category emoji + label near author info.

### Implementation for User Story 3

- [x] T014 [US3] Add category badge (emoji + label from `CATEGORIES` map) as a styled pill element near author info section in `app/components/PostPopup.tsx`
- [x] T015 [US3] Handle legacy posts with missing category by defaulting display to "💬 Discussion" in `app/components/PostPopup.tsx`

**Checkpoint**: User Story 3 complete — popup displays category for all posts including legacy defaults.

---

## Phase 6: User Story 4 — Overlapping Pin Clustering & List Selection (Priority: P1) MVP

**Goal**: Overlapping pins merge into cluster markers with numeric badges. Clicking a cluster opens a chronological list panel. Selecting a post opens the existing popup.

**Independent Test**: Create 3 posts at same coordinates → verify cluster marker shows "3" → click → list panel → select post → popup opens.

### Implementation for User Story 4

- [x] T016 [US4] Initialize `atlas.source.DataSource` with `cluster: true`, `clusterRadius: 50`, `clusterMaxZoom: 18`, and `clusterProperties` for per-category counts in `app/components/MapView.tsx`
- [x] T017 [US4] Populate DataSource with GeoJSON Point features from `posts` prop, mapping each post to a Feature with `category`, `postId`, and metadata as properties in `app/components/MapView.tsx`
- [x] T018 [US4] Implement `renderMarkers` function that reads DataSource shapes, creates speech-bubble HtmlMarkers for individual points and cluster HtmlMarkers (circular badge with `point_count`) for clusters in `app/components/MapView.tsx`
- [x] T019 [US4] Bind `renderMarkers` to map `moveend` and `sourcedata` events so markers update on zoom/pan and data changes in `app/components/MapView.tsx`
- [x] T020 [US4] Create `ClusterListPanel` component that receives an array of `PostSummary` items sorted newest-first and renders each with category emoji, text preview (truncated), author name, and time remaining in `app/components/ClusterListPanel.tsx`
- [x] T021 [US4] Add cluster marker click handler that calls `datasource.getClusterLeaves(clusterId)`, maps results to `PostSummary` objects, and opens `ClusterListPanel` in `app/components/MapView.tsx`
- [x] T022 [US4] Add post selection handler in `ClusterListPanel` that calls parent callback to open `PostPopup` for the selected post in `app/components/ClusterListPanel.tsx`
- [x] T023 [US4] Auto-close `ClusterListPanel` on map `movestart` event (pan/zoom while panel is open) in `app/components/MapView.tsx`
- [x] T024 [US4] Apply search highlight/dim to cluster markers: highlight if any contained post matches search results, dim if none match, using `searchResultPostIds` prop in `app/components/MapView.tsx`

**Checkpoint**: User Story 4 complete — all overlapping pins are accessible via cluster list, resolving the "back pins unselectable" problem.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, legacy compatibility, and validation.

- [x] T025 [P] Handle legacy posts without `category` field across all components — ensure `category ?? "discussion"` fallback in `app/components/MapView.tsx` and `app/components/PostPopup.tsx`
- [x] T026 [P] Update seed script to include `category` field in sample posts, covering all 5 categories in `scripts/seed.ts`
- [x] T027 Run `npx tsc --noEmit` to verify zero type errors across all modified files
- [x] T028 Run quickstart.md verification checklist (all 6 sections) end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001, T002, T003) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can start once API accepts category
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (different files: MapView vs PostCreateModal)
- **US3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2 (different file: PostPopup)
- **US4 (Phase 6)**: Depends on Phase 4 (US2) — needs speech-bubble rendering in MapView before adding clustering on top
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2 — PostCreateModal only
- **US2 (P1)**: Independent after Phase 2 — MapView speech-bubble rendering
- **US3 (P2)**: Independent after Phase 2 — PostPopup only
- **US4 (P1)**: Depends on US2 completion (T010–T013 must be done before T016–T024 since clustering builds on top of the speech-bubble marker rendering in MapView)

### Within Each User Story

- Core rendering/logic before integration
- Handler wiring after component creation
- Edge cases in Polish phase

### Parallel Opportunities

**Phase 1** (all [P] tasks):
```
T001 (types/index.ts)  ⟶  parallel  ⟵  T002 (categories.ts)
```
Then T003 (db.ts) after T001 (needs PostCategory type).

**Phase 2** (after Phase 1):
```
T004 (validation.ts)  ⟶  parallel start, then T005/T006 depend on T004
```

**Phase 3 + 4 + 5** (after Phase 2, can run in parallel):
```
US1: T007–T009 (PostCreateModal.tsx)
US2: T010–T013 (MapView.tsx)          ← can run in parallel with US1
US3: T014–T015 (PostPopup.tsx)         ← can run in parallel with US1 and US2
```

**Phase 6** (after Phase 4):
```
US4: T016–T024 (MapView.tsx + ClusterListPanel.tsx) — sequential within MapView
     T020, T022 (ClusterListPanel.tsx) can be written in parallel with T016–T019
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006)
3. Complete Phase 3: US1 — Category selection in modal (T007–T009)
4. Complete Phase 4: US2 — Speech-bubble pins on map (T010–T013)
5. **STOP and VALIDATE**: Create posts with different categories, verify distinct pins
6. Deploy/demo if ready — this is the core MVP

### Incremental Delivery

1. Setup + Foundational → API ready
2. US1 (category selection) → Users can pick a category → Demo
3. US2 (speech-bubble pins) → Visual distinction on map → Demo (MVP!)
4. US3 (popup display) → Category confirmed in detail view → Demo
5. US4 (clustering) → Overlapping pins accessible → Demo (full feature)
6. Polish → Edge cases, legacy compat, seed data → Release

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 28 |
| Phase 1 (Setup) | 3 |
| Phase 2 (Foundational) | 3 |
| US1 (Category Selection) | 3 |
| US2 (Pin Display) | 4 |
| US3 (Popup Display) | 2 |
| US4 (Clustering) | 9 |
| Polish | 4 |
| Parallel opportunities | 8 tasks can run in parallel across phases |
| New files | 2 (`categories.ts`, `ClusterListPanel.tsx`) |
| Modified files | 6 (`types/index.ts`, `db.ts`, `validation.ts`, `route.ts`, `PostCreateModal.tsx`, `MapView.tsx`, `PostPopup.tsx`, `seed.ts`) |
| MVP scope | US1 + US2 (10 tasks through T013) |
