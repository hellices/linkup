# Tasks: LinkUp Map-First MVP + AI Foundry Semantic Search + MCP Integration

**Input**: Design documents from `/specs/001-map-first-mvp/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/openapi.yaml ✅, quickstart.md ✅

**Tests**: Not included (not explicitly requested). Unit tests deferred to post-MVP per plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Timebox: 100 minutes total.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **App Router**: `app/` at repository root (Next.js 14 App Router)
- **MCP Server**: `app/lib/mcp/` (in-process module, not a separate process)
- **Tests**: `tests/` at repository root (post-MVP)

---

## Phase 1: Setup (M0 — 10m)

**Purpose**: Next.js project initialization + environment variable stubs + App Shell UI skeleton

- [ ] T001 Initialize Next.js 14 project with TypeScript + App Router + Tailwind CSS per plan.md structure
- [ ] T002 [P] Create `.env.local` template with all env var stubs (AUTH, MAPS, AI_FOUNDRY, MCP) in `.env.local.example`
- [ ] T003 [P] Define shared TypeScript types (Post, Engagement, McpSuggestion, CombinedSuggestionsResponse, SemanticSearchResponse) in `app/types/index.ts`
- [ ] T004 Create root layout with Auth provider wrapper + Azure Maps CSS import in `app/layout.tsx`
- [ ] T005 Create main page with full-screen map container placeholder + search bar input placeholder + FAB "+" button placeholder in `app/page.tsx`

**Checkpoint**: `npm run dev` → local execution OK, map placeholder/search bar/floating button visible on screen

---

## Phase 2: Foundational (M0–M2 — 28m)

**Purpose**: Entra ID authentication, Azure Maps rendering, data model/storage, shared utilities — prerequisites for all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Auth (US6 — Entra ID Login, P1 prerequisite)

- [ ] T006 Configure Auth.js v5 with `microsoft-entra-id` provider + session callbacks in `app/lib/auth.ts`
- [ ] T007 Create Auth.js route handler in `app/api/auth/[...nextauth]/route.ts`
- [ ] T008 [P] Create AuthButton component (SignIn/SignOut) in `app/components/AuthButton.tsx`
- [ ] T009 Add Next.js middleware for write-protection (POST routes require auth) in `middleware.ts`

### Azure Maps (Map Infrastructure)

- [ ] T010 Create MapView client component with `react-azure-maps` (`'use client'` + `AzureMap` + click event handler) in `app/components/MapView.tsx`
- [ ] T011 Configure `next/dynamic` SSR-disabled import for MapView in `app/page.tsx`

### Data Model & Storage

- [ ] T012 Initialize `better-sqlite3` DB with `posts` + `engagements` tables (CREATE TABLE IF NOT EXISTS per data-model.md SQL schema) in `app/lib/db.ts`
- [ ] T013 [P] Create 3-sentence validation utility (regex counting with URL/ellipsis exclusion per R6) in `app/lib/validation.ts`

**Checkpoint**: Entra login/logout working, map pan/zoom working, click coordinates obtainable, DB initialization complete. Unauthenticated users → write API blocked.

---

## Phase 3: User Story 1 — Map Post Creation (Priority: P1) 🎯 MVP

**Goal**: Entra-authenticated user clicks map → 3-sentence post + TTL → save → display marker on map

**Independent Test**: Entra login → "+" button → write 3 sentences → select TTL → save → verify new marker displayed on map

### Implementation for User Story 1

- [ ] T014 [US1] Implement POST `/api/posts` route with 3-sentence validation + TTL → expiresAt calculation + lat/lng required + authorId from session in `app/api/posts/route.ts`
- [ ] T015 [P] [US1] Create PostCreateModal component with text input (3-sentence real-time feedback) + TTL selector (1m/24h/72h/7d) + tags input + Save/Cancel in `app/components/PostCreateModal.tsx`
- [ ] T016 [US1] Wire map click → capture (lat, lng) → open PostCreateModal with coordinates in `app/components/MapView.tsx`
- [ ] T017 [P] [US1] Create PostMarker component for rendering individual post markers on map in `app/components/PostMarker.tsx`
- [ ] T018 [US1] Wire post creation → POST /api/posts → add new marker to map immediately (re-fetch or optimistic update) in `app/page.tsx`

**Checkpoint**: Post creation (3 sentences+TTL+coordinates) → marker displayed on map immediately. Exceeds 3 sentences/no TTL/no coordinates → returns 400.

---

## Phase 4: User Story 2 — Map Discovery & Post Viewing (Priority: P1)

**Goal**: Display active posts within the viewport as markers during map exploration, and view details in popup

**Independent Test**: Click marker on map with existing posts → verify popup shows post summary, remaining time, participation button placeholder, MCP suggestion placeholder

### Implementation for User Story 2

- [ ] T019 [US2] Implement GET `/api/posts` route with bbox filtering (swLat/swLng/neLat/neLng) + TTL expire exclusion (`WHERE expiresAt > datetime('now')`) in `app/api/posts/route.ts`
- [ ] T020 [P] [US2] Create PostPopup component with post text, tags, remaining TTL, Interested/Join buttons (placeholder), "Suggested via MCP" section (placeholder) in `app/components/PostPopup.tsx`
- [ ] T021 [US2] Wire map viewport change (moveend event) → GET /api/posts with current bbox → render PostMarker components in `app/components/MapView.tsx`
- [ ] T022 [US2] Handle empty map area state ("No posts in this area yet" message) in `app/components/MapView.tsx`

**Checkpoint**: Post markers load for the area on map move/zoom, marker click → popup opens (MCP/participation are placeholder).

---

## Phase 5: User Story 3 — MCP + AI Foundry Integrated Search (Priority: P1)

**Goal**: Display combined Docs/Issues/Posts suggestions + Action Hint in post popup, semantic search + bbox re-filtering in map search

**Independent Test**:
- Open post popup → verify combined Docs/Issues/Posts results displayed in "Suggested via MCP" section
- Verify 1-line Action Hint displayed at top of results
- Verify semantic search results displayed as markers within current view area during map search
- Verify "No suggestions available" displayed on MCP server failure

### AI Foundry Core (M4)

- [ ] T023 [P] [US3] Create AI Foundry client with AzureOpenAI embeddings (`text-embedding-3-small`) + chat completions (`gpt-4o-mini`) + fallback handling in `app/lib/ai-foundry.ts`
- [ ] T024 [P] [US3] Create cosine similarity utility function in `app/lib/cosine.ts`

### MCP Server (M5 — in-process module)

- [ ] T025 [P] [US3] Create MCP server singleton with tool registration in `app/lib/mcp/server.ts` — in-process connection with mcp-client via InMemoryTransport

#### M365 Internal Resources Search (PRIMARY)

- [ ] T025a [P] [US3] Create pre-embedded unified M365 sample data (9 items: 3 OneDrive + 3 SharePoint + 3 Email, each with title/url/description/source/vector) in `app/lib/mcp/data/sample-m365.json`
- [ ] T025b [P] [US3] Implement `search_m365` tool (query → embed via app's ai-foundry → cosine similarity against pre-embedded sample-m365 → top 1–5 results tagged with source sub-field; fallback to returning all data when AI Foundry is unavailable) in `app/lib/mcp/tools/search-m365.ts`

#### Web Resources Search (SUPPLEMENTARY)

- [ ] T026 [P] [US3] Create pre-embedded sample docs data (1~3 Azure Docs items with title/url/description/vector) in `app/lib/mcp/data/sample-docs.json`
- [ ] T027 [P] [US3] Create pre-embedded sample issues data (1~2 GitHub Issues items with title/url/description/vector) in `app/lib/mcp/data/sample-issues.json`
- [ ] T028 [P] [US3] Implement `search_docs` tool (query → embed via app's ai-foundry → cosine similarity against pre-embedded sample-docs → top 1~3 results; fallback to returning all data when AI Foundry is unavailable) in `app/lib/mcp/tools/search-docs.ts`
- [ ] T029 [P] [US3] Implement `search_issues` tool (query → embed via app's ai-foundry → cosine similarity against pre-embedded sample-issues → top 0~2 results; fallback to returning all data when AI Foundry is unavailable) in `app/lib/mcp/tools/search-issues.ts`
- [ ] T030 [P] [US3] Implement `search_posts` tool (query → direct access to app's PostEmbedding cache → cosine similarity → top 0~5 results; no HTTP callback needed) in `app/lib/mcp/tools/search-posts.ts`
- [ ] T031 [P] [US3] Implement `generate_action_hint` tool (searchResults → generate 1-line hint via app's ai-foundry GPT-4o-mini; template fallback when AI Foundry is unavailable) in `app/lib/mcp/tools/action-hint.ts`

### API Integration

- [ ] T032 [US3] Create MCP client wrapper with LLM-driven tool orchestration (connect to in-process McpServer via InMemoryTransport → listTools() → convert to OpenAI function-calling → GPT-4o-mini decides which tools to call → callTool() loop → LLM returns structured CombinedSuggestionsResponse; hardcoded parallel fallback when AI Foundry is unavailable) in `app/lib/mcp-client.ts`
- [ ] T033 [US3] Implement GET `/api/posts/[postId]/suggestions` route (fetch post → call MCP + AI Foundry → combine docs/issues/posts + actionHint → graceful degrade) in `app/api/posts/[postId]/suggestions/route.ts`
- [ ] T034 [US3] Implement GET `/api/search` route (query embedding → cosine vs all PostEmbeddings → bbox filter → return SemanticSearchResponse with outOfBounds count) in `app/api/search/route.ts`

### Frontend Integration

- [ ] T035 [P] [US3] Create SuggestionsPanel component ("Suggested via MCP" label + categorized results + Action Hint + "No suggestions available" fallback) in `app/components/SuggestionsPanel.tsx`
- [ ] T036 [P] [US3] Create SearchBar component with search input + semantic search trigger in `app/components/SearchBar.tsx`
- [ ] T037 [US3] Wire PostPopup → GET /api/posts/{postId}/suggestions → SuggestionsPanel rendering in `app/components/PostPopup.tsx`
- [ ] T038 [US3] Wire SearchBar → GET /api/search → filtered markers rendering + "N results outside map" indicator on map in `app/page.tsx`

**Checkpoint**: Popup shows M365 internal resources (OneDrive/SharePoint/Email) prioritized + 1~3 Docs links + 1-line Action Hint + "Suggested via MCP" label. Search → semantic search → markers highlighted within bbox. Graceful degrade on MCP failure.

---

## Phase 6: User Story 4 — Collaboration Signal (Priority: P2)

**Goal**: Authenticated user marks Interested/Join on a post and views participant count

**Independent Test**: Authenticated user clicks "Join" in post popup → verify participant count increases. Same user clicking again does not result in duplicate count.

### Implementation for User Story 4

- [ ] T039 [US4] Implement POST `/api/posts/[postId]/engagement` route with idempotent upsert (INSERT OR REPLACE on postId+userId unique) + return updated counts in `app/api/posts/[postId]/engagement/route.ts`
- [ ] T040 [US4] Wire Interested/Join buttons in PostPopup → POST engagement → update interestedCount/joinCount display in `app/components/PostPopup.tsx`
- [ ] T041 [US4] Add auth guard on engagement buttons (unauthenticated → prompt login) in `app/components/PostPopup.tsx`

**Checkpoint**: Join click → count increases, re-click → no duplicate increase, unauthenticated → login required.

---

## Phase 7: User Story 5 — TTL Expiration (Priority: P2)

**Goal**: Verify that TTL-expired posts are automatically excluded from map/queries

**Independent Test**: Create post with short TTL (1m) → refresh map after 1 minute → verify marker has disappeared

### Implementation for User Story 5

- [ ] T042 [US5] Verify TTL expire filter excludes expired posts from GET /api/posts and GET /api/posts/{postId}/suggestions (already implemented in T019, validate edge cases)
- [ ] T043 [US5] Add expired-post handling in PostPopup (show "This post has expired" message when TTL expires while popup is open) in `app/components/PostPopup.tsx`

**Checkpoint**: After expiration, marker disappears from map and is excluded from query/search results.

---

## Phase 8: Polish & Cross-Cutting Concerns (M6 — 11m)

**Purpose**: 2-minute demo preparation + minimum submission document set + full validation

- [ ] T044 [P] Create `docs/mcp.md` with MCP server architecture, multi-source value, Docs+Issues integration flow explanation
- [ ] T045 [P] Create `docs/copilot-notes.md` with GitHub Copilot usage records (minimum 3 examples)
- [ ] T046 Update `README.md` with AI Foundry semantic search + MCP architecture summary + quickstart reference
- [ ] T047 Run 2-minute demo rehearsal per `specs/001-map-first-mvp/quickstart.md` Demo Script (8 steps)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─→ Phase 2 (Foundational) ← BLOCKS ALL USER STORIES
        ├─→ Phase 3 (US1: Post Creation) ← P1
        │     └─→ Phase 4 (US2: Discovery) ← P1, needs posts to exist
        │           ├─→ Phase 5 (US3: MCP+AI) ← P1, needs popup
        │           └─→ Phase 6 (US4: Engagement) ← P2, needs popup
        ├─→ Phase 7 (US5: TTL) ← P2, can verify after US1+US2
        └─→ Phase 8 (Polish) ← after all stories
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US1 (Map Post Creation) | Phase 2 (Foundational) | — |
| US2 (Map Discovery) | US1 (needs posts to display) | — |
| US3 (MCP + AI Foundry) | US2 (needs popup UI) | US4 partially |
| US4 (Collaboration) | US2 (needs popup UI) | US3 partially |
| US5 (TTL Expiration) | US1 + US2 (needs posts + list) | US3, US4 |

### Within Each User Story

- Models/utils before APIs
- APIs before frontend components
- Core implementation before integration wiring
- Story complete and checkpoint verified before moving to next priority

### Parallel Opportunities

**Phase 2 parallelism:**
- T008 (AuthButton) ∥ T010 (MapView) ∥ T012 (DB init) ∥ T013 (validation)

**Phase 3 parallelism:**
- T015 (PostCreateModal) ∥ T017 (PostMarker) — different files

**Phase 5 parallelism (largest):**
- T023 (AI Foundry client) ∥ T024 (cosine) ∥ T025–T031 (all MCP server files including T025b AI Foundry client) — all independent files
- T035 (SuggestionsPanel) ∥ T036 (SearchBar) — different components

**Phase 8 parallelism:**
- T044 (mcp.md) ∥ T045 (copilot-notes.md) — independent docs

---

## Parallel Example: Phase 5 (MCP + AI Foundry)

```bash
# Batch 1: All independent utility/server files (9+ tasks in parallel)
T023: "Create AI Foundry client in app/lib/ai-foundry.ts"
T024: "Create cosine similarity utility in app/lib/cosine.ts"
T025: "Create McpServer factory in app/lib/mcp/server.ts (InMemoryTransport)"
T025a: "Create unified M365 sample data in app/lib/mcp/data/sample-m365.json"     # PRIMARY
T026: "Create sample docs data in app/lib/mcp/data/sample-docs.json"              # supplementary
T027: "Create sample issues data in app/lib/mcp/data/sample-issues.json"          # supplementary
T025b: "Implement search_m365 tool in app/lib/mcp/tools/search-m365.ts"            # PRIMARY
T028: "Implement search_docs tool in app/lib/mcp/tools/search-docs.ts"            # supplementary
T029: "Implement search_issues tool in app/lib/mcp/tools/search-issues.ts"        # supplementary
T030: "Implement search_posts tool in app/lib/mcp/tools/search-posts.ts (direct cache access)"
T031: "Implement generate_action_hint tool in app/lib/mcp/tools/action-hint.ts"

# Batch 3: API routes (depend on MCP client + AI Foundry)
T032: "Create MCP client wrapper in app/lib/mcp-client.ts"
T033: "Implement GET /api/posts/[postId]/suggestions"
T034: "Implement GET /api/search"

# Batch 4: Frontend (depend on API routes)
T035: "Create SuggestionsPanel component"  ∥  T036: "Create SearchBar component"
T037: "Wire PostPopup → suggestions"
T038: "Wire SearchBar → search → map"
```

---

## Implementation Strategy

### MVP First (US1 Only — ~48m)

1. Complete Phase 1: Setup (10m)
2. Complete Phase 2: Foundational (28m)
3. Complete Phase 3: US1 — Map Post Creation (10m)
4. **STOP and VALIDATE**: Entra login → post creation → map marker display
5. This alone delivers the core value of "posting questions on the map"

### Incremental Delivery (100m full)

1. Setup + Foundational → Foundation ready (38m)
2. US1 → post creation working (48m) → **MVP checkpoint**
3. US2 → map exploration + popup (60m) → **Discovery checkpoint**
4. US3 → MCP + AI Foundry integration (90m) → **core differentiation checkpoint**
5. US4 → Interested/Join (95m)
6. US5 → TTL verification (97m)
7. Polish → demo preparation (100m) → **2-minute demo ready**

### Definition of Done

- [ ] Post creation/display/participation available on map (Azure Maps) after Entra login
- [ ] 3-sentence limit + TTL required + expired posts excluded
- [ ] AI Foundry semantic search enables "filter to only what I want" on the map
- [ ] External resource suggestions visible via MCP (Suggested via MCP), multi-source combination demonstrated
- [ ] Action Hint suggests "next action"
- [ ] Documentation (mcp.md, copilot-notes.md) exists
- [ ] 2-minute demo completable

---

## Task → FR Traceability

| Task(s) | FR | User Story |
|---------|-----|------------|
| T006–T009 | FR-001, FR-002 | US6 (Foundational) |
| T010–T011 | FR-003 | US2 (Foundational) |
| T014–T018 | FR-004, FR-005, FR-006, FR-007, FR-020 | US1 |
| T019–T022 | FR-003, FR-008, FR-012 | US2 |
| T023–T038 | FR-013, FR-014, FR-015, FR-016, FR-017, FR-018 | US3 (M365 primary + web supplementary) |
| T039–T041 | FR-009, FR-010, FR-011 | US4 |
| T042–T043 | FR-012 | US5 |
| T012–T013 | FR-005, FR-019, FR-020 | Shared |

---

## Notes

- [P] tasks = different files, no dependencies → safe to parallelize
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable at its checkpoint
- Commit after each task or logical group
- Total: 49 tasks across 8 phases (M365 unified tool +2)
- AI Foundry fallback: return hardcoded results if Azure services unavailable (T023, T025b)
- MCP graceful degrade: on partial failure show only successful sources, on total failure show "No suggestions available" (T033)
- MCP server's AI Foundry client (T025b):
  - Embedding failure → fallback to returning all data
  - Chat failure → template-based hint fallback
  - `/api/search` callback failure → return empty array
