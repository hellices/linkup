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
- **MCP Server**: `mcp-server/` at repository root (sidecar process)
- **Tests**: `tests/` at repository root (post-MVP)

---

## Phase 1: Setup (M0 — 10m)

**Purpose**: Next.js 프로젝트 초기화 + 환경 변수 스텁 + App Shell UI 골격

- [ ] T001 Initialize Next.js 14 project with TypeScript + App Router + Tailwind CSS per plan.md structure
- [ ] T002 [P] Create `.env.local` template with all env var stubs (AUTH, MAPS, AI_FOUNDRY, MCP) in `.env.local.example`
- [ ] T003 [P] Define shared TypeScript types (Post, Engagement, McpSuggestion, CombinedSuggestionsResponse, SemanticSearchResponse) in `app/types/index.ts`
- [ ] T004 Create root layout with Auth provider wrapper + Azure Maps CSS import in `app/layout.tsx`
- [ ] T005 Create main page with full-screen map container placeholder + search bar input placeholder + FAB "+" button placeholder in `app/page.tsx`

**Checkpoint**: `npm run dev` → 로컬 실행 OK, 화면에 지도 자리/검색바/플로팅 버튼이 보임

---

## Phase 2: Foundational (M0–M2 — 28m)

**Purpose**: Entra ID 인증, Azure Maps 렌더링, 데이터 모델/저장소, 공유 유틸리티 — 모든 유저 스토리의 전제 조건

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Auth (US6 — Entra ID Login, P1 prerequisite)

- [ ] T006 Configure Auth.js v5 with `microsoft-entra-id` provider + session callbacks in `app/lib/auth.ts`
- [ ] T007 Create Auth.js route handler in `app/api/auth/[...nextauth]/route.ts`
- [ ] T008 [P] Create AuthButton component (SignIn/SignOut) in `app/components/AuthButton.tsx`
- [ ] T009 Add Next.js middleware for write-protection (POST routes require auth) in `middleware.ts`

### Azure Maps (지도 인프라)

- [ ] T010 Create MapView client component with `react-azure-maps` (`'use client'` + `AzureMap` + click event handler) in `app/components/MapView.tsx`
- [ ] T011 Configure `next/dynamic` SSR-disabled import for MapView in `app/page.tsx`

### Data Model & Storage

- [ ] T012 Initialize `better-sqlite3` DB with `posts` + `engagements` tables (CREATE TABLE IF NOT EXISTS per data-model.md SQL schema) in `app/lib/db.ts`
- [ ] T013 [P] Create 3-sentence validation utility (regex counting with URL/ellipsis exclusion per R6) in `app/lib/validation.ts`

**Checkpoint**: Entra 로그인/로그아웃 동작, 지도 pan/zoom 동작, 클릭 좌표 얻기 가능, DB 초기화 완료. 비로그인 사용자 → 쓰기 API 차단됨.

---

## Phase 3: User Story 1 — Map Post Creation (Priority: P1) 🎯 MVP

**Goal**: Entra 로그인 사용자가 지도 클릭 → 3문장 포스트 + TTL → 저장 → 지도 마커 표시

**Independent Test**: Entra 로그인 → "+" 버튼 → 3문장 작성 → TTL 선택 → 저장 → 지도에 새 마커 표시 확인

### Implementation for User Story 1

- [ ] T014 [US1] Implement POST `/api/posts` route with 3-sentence validation + TTL → expiresAt calculation + lat/lng required + authorId from session in `app/api/posts/route.ts`
- [ ] T015 [P] [US1] Create PostCreateModal component with text input (3-sentence real-time feedback) + TTL selector (1m/24h/72h/7d) + tags input + Save/Cancel in `app/components/PostCreateModal.tsx`
- [ ] T016 [US1] Wire map click → capture (lat, lng) → open PostCreateModal with coordinates in `app/components/MapView.tsx`
- [ ] T017 [P] [US1] Create PostMarker component for rendering individual post markers on map in `app/components/PostMarker.tsx`
- [ ] T018 [US1] Wire post creation → POST /api/posts → add new marker to map immediately (re-fetch or optimistic update) in `app/page.tsx`

**Checkpoint**: 포스트 생성 (3문장+TTL+좌표) → 지도에 즉시 마커 표시. 3문장 초과/TTL 없음/좌표 없음 → 400 반환.

---

## Phase 4: User Story 2 — Map Discovery & Post Viewing (Priority: P1)

**Goal**: 지도 탐색 시 영역 내 활성 포스트를 마커로 표시하고 팝업에서 상세 확인

**Independent Test**: 기존 포스트가 있는 지도에서 마커 클릭 → 팝업에 포스트 요약, 남은 시간, 참여 버튼 placeholder, MCP 추천 placeholder 표시 확인

### Implementation for User Story 2

- [ ] T019 [US2] Implement GET `/api/posts` route with bbox filtering (swLat/swLng/neLat/neLng) + TTL expire exclusion (`WHERE expiresAt > datetime('now')`) in `app/api/posts/route.ts`
- [ ] T020 [P] [US2] Create PostPopup component with post text, tags, remaining TTL, Interested/Join buttons (placeholder), "Suggested via MCP" section (placeholder) in `app/components/PostPopup.tsx`
- [ ] T021 [US2] Wire map viewport change (moveend event) → GET /api/posts with current bbox → render PostMarker components in `app/components/MapView.tsx`
- [ ] T022 [US2] Handle empty map area state ("이 지역에는 아직 포스트가 없습니다" message) in `app/components/MapView.tsx`

**Checkpoint**: 지도 이동/줌 시 해당 영역의 포스트 마커 로드, 마커 클릭 → 팝업 열림 (MCP/참여는 placeholder).

---

## Phase 5: User Story 3 — MCP + AI Foundry Integrated Search (Priority: P1)

**Goal**: 포스트 팝업에 Docs/Issues/Posts 결합 추천 + Action Hint 표시, 지도 검색에서 semantic search + bbox 재필터링

**Independent Test**:
- 포스트 팝업 열기 → "Suggested via MCP" 섹션에 Docs/Issues/Posts 결합 결과 표시 확인
- Action Hint 1줄이 결과 상단에 표시됨을 확인
- 지도 검색 시 semantic search 결과가 현재 뷰 영역 내 마커로 표시됨을 확인
- MCP 서버 장애 시 "No suggestions available" 표시를 확인

### AI Foundry Core (M4)

- [ ] T023 [P] [US3] Create AI Foundry client with AzureOpenAI embeddings (`text-embedding-3-small`) + chat completions (`gpt-4o-mini`) + fallback handling in `app/lib/ai-foundry.ts`
- [ ] T024 [P] [US3] Create cosine similarity utility function in `app/lib/cosine.ts`

### MCP Server (M5)

- [ ] T025 [P] [US3] Create MCP server entry point with Streamable HTTP transport (port 3001) + tool registration in `mcp-server/index.ts`
- [ ] T026 [P] [US3] Create pre-embedded sample docs data (1~3 Azure Docs items with title/url/description/vector) in `mcp-server/data/sample-docs.json`
- [ ] T027 [P] [US3] Create pre-embedded sample issues data (1~2 GitHub Issues items with title/url/description/vector) in `mcp-server/data/sample-issues.json`
- [ ] T028 [P] [US3] Implement `search_docs` tool (query → cosine similarity against sample-docs → top 1~3 results) in `mcp-server/tools/search-docs.ts`
- [ ] T029 [P] [US3] Implement `search_issues` tool (query → cosine similarity against sample-issues → top 0~2 results) in `mcp-server/tools/search-issues.ts`
- [ ] T030 [P] [US3] Implement `search_posts` tool (query → embed → cosine similarity against PostEmbeddings → top 0~5 results) in `mcp-server/tools/search-posts.ts`
- [ ] T031 [P] [US3] Implement `generate_action_hint` tool (search results → template or gpt-4o-mini → 1-line hint) in `mcp-server/tools/action-hint.ts`

### API Integration

- [ ] T032 [US3] Create MCP client wrapper (connect to MCP server, call search_docs/search_issues/search_posts, combine results into CombinedSuggestionsResponse) in `app/lib/mcp-client.ts`
- [ ] T033 [US3] Implement GET `/api/posts/[postId]/suggestions` route (fetch post → call MCP + AI Foundry → combine docs/issues/posts + actionHint → graceful degrade) in `app/api/posts/[postId]/suggestions/route.ts`
- [ ] T034 [US3] Implement GET `/api/search` route (query embedding → cosine vs all PostEmbeddings → bbox filter → return SemanticSearchResponse with outOfBounds count) in `app/api/search/route.ts`

### Frontend Integration

- [ ] T035 [P] [US3] Create SuggestionsPanel component ("Suggested via MCP" label + categorized results + Action Hint + "No suggestions available" fallback) in `app/components/SuggestionsPanel.tsx`
- [ ] T036 [P] [US3] Create SearchBar component with search input + semantic search trigger in `app/components/SearchBar.tsx`
- [ ] T037 [US3] Wire PostPopup → GET /api/posts/{postId}/suggestions → SuggestionsPanel rendering in `app/components/PostPopup.tsx`
- [ ] T038 [US3] Wire SearchBar → GET /api/search → filtered markers rendering + "지도 밖 N건" indicator on map in `app/page.tsx`

**Checkpoint**: 팝업에서 Docs 링크 1~3개 + Action Hint 1줄 + "Suggested via MCP" 라벨 표시. 검색 → semantic search → bbox 내 마커 강조. MCP 실패 시 graceful degrade.

---

## Phase 6: User Story 4 — Collaboration Signal (Priority: P2)

**Goal**: 인증된 사용자가 포스트에 Interested/Join을 표시하고 참여자 수를 확인

**Independent Test**: 인증된 사용자가 포스트 팝업에서 "Join" 클릭 → 참여자 수 증가 확인. 동일 사용자가 다시 클릭 시 중복 카운트되지 않음.

### Implementation for User Story 4

- [ ] T039 [US4] Implement POST `/api/posts/[postId]/engagement` route with idempotent upsert (INSERT OR REPLACE on postId+userId unique) + return updated counts in `app/api/posts/[postId]/engagement/route.ts`
- [ ] T040 [US4] Wire Interested/Join buttons in PostPopup → POST engagement → update interestedCount/joinCount display in `app/components/PostPopup.tsx`
- [ ] T041 [US4] Add auth guard on engagement buttons (비인증 → 로그인 유도) in `app/components/PostPopup.tsx`

**Checkpoint**: Join 클릭 → 카운트 증가, 재클릭 → 중복 증가 없음, 비인증 → 로그인 요구.

---

## Phase 7: User Story 5 — TTL Expiration (Priority: P2)

**Goal**: TTL 만료 포스트가 지도/조회에서 자동 제외되는 동작 확인

**Independent Test**: 짧은 TTL(1m) 포스트 생성 → 1분 후 지도 새로고침 → 해당 마커가 사라짐 확인

### Implementation for User Story 5

- [ ] T042 [US5] Verify TTL expire filter excludes expired posts from GET /api/posts and GET /api/posts/{postId}/suggestions (already implemented in T019, validate edge cases)
- [ ] T043 [US5] Add expired-post handling in PostPopup (팝업 열린 중 TTL 만료 시 "이 포스트는 만료되었습니다" 메시지) in `app/components/PostPopup.tsx`

**Checkpoint**: 만료 후 마커가 지도에서 사라지고, 조회/검색 결과에서 제외됨.

---

## Phase 8: Polish & Cross-Cutting Concerns (M6 — 11m)

**Purpose**: 2분 데모 준비 + 제출 문서 최소 세트 + 전체 검증

- [ ] T044 [P] Create `docs/mcp.md` with MCP server architecture, multi-source value, Docs+Issues integration flow explanation
- [ ] T045 [P] Create `docs/copilot-notes.md` with GitHub Copilot usage records (최소 3개 사례)
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
- T023 (AI Foundry client) ∥ T024 (cosine) ∥ T025–T031 (all MCP server files) — all independent files
- T035 (SuggestionsPanel) ∥ T036 (SearchBar) — different components

**Phase 8 parallelism:**
- T044 (mcp.md) ∥ T045 (copilot-notes.md) — independent docs

---

## Parallel Example: Phase 5 (MCP + AI Foundry)

```bash
# Batch 1: All independent utility/server files (8 tasks in parallel)
T023: "Create AI Foundry client in app/lib/ai-foundry.ts"
T024: "Create cosine similarity utility in app/lib/cosine.ts"
T025: "Create MCP server entry in mcp-server/index.ts"
T026: "Create sample docs data in mcp-server/data/sample-docs.json"
T027: "Create sample issues data in mcp-server/data/sample-issues.json"
T028: "Implement search_docs tool in mcp-server/tools/search-docs.ts"
T029: "Implement search_issues tool in mcp-server/tools/search-issues.ts"
T031: "Implement generate_action_hint tool in mcp-server/tools/action-hint.ts"

# Batch 2: Tools depending on AI Foundry client
T030: "Implement search_posts tool in mcp-server/tools/search-posts.ts"

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
4. **STOP and VALIDATE**: Entra 로그인 → 포스트 생성 → 지도 마커 표시
5. This alone delivers "지도 위에 질문을 올리는" 기본 가치

### Incremental Delivery (100m full)

1. Setup + Foundational → Foundation ready (38m)
2. US1 → 포스트 생성 동작 (48m) → **MVP checkpoint**
3. US2 → 지도 탐색 + 팝업 (60m) → **Discovery checkpoint**
4. US3 → MCP + AI Foundry 통합 (90m) → **핵심 차별화 checkpoint**
5. US4 → Interested/Join (95m)
6. US5 → TTL 검증 (97m)
7. Polish → 데모 준비 (100m) → **2분 데모 가능**

### Definition of Done

- [ ] Entra 로그인 후 지도(Azure Maps)에서 포스트 생성/표시/참여 가능
- [ ] 3문장 제한 + TTL 필수 + 만료 제외
- [ ] AI Foundry semantic search로 지도에서 "내가 원하는 것만 추려보기" 동작
- [ ] MCP로 외부 리소스 추천이 보이며(Suggested via MCP), multi-source 결합 시연
- [ ] Action Hint로 "다음 행동"이 제시됨
- [ ] 문서(mcp.md, copilot-notes.md) 존재
- [ ] 2분 데모 완료 가능

---

## Task → FR Traceability

| Task(s) | FR | User Story |
|---------|-----|------------|
| T006–T009 | FR-001, FR-002 | US6 (Foundational) |
| T010–T011 | FR-003 | US2 (Foundational) |
| T014–T018 | FR-004, FR-005, FR-006, FR-007, FR-020 | US1 |
| T019–T022 | FR-003, FR-008, FR-012 | US2 |
| T023–T038 | FR-013, FR-014, FR-015, FR-016, FR-017, FR-018 | US3 |
| T039–T041 | FR-009, FR-010, FR-011 | US4 |
| T042–T043 | FR-012 | US5 |
| T012–T013 | FR-005, FR-019, FR-020 | Shared |

---

## Notes

- [P] tasks = different files, no dependencies → safe to parallelize
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable at its checkpoint
- Commit after each task or logical group
- Total: 47 tasks across 8 phases
- AI Foundry fallback: 하드코딩된 결과 반환 if Azure services unavailable (T023)
- MCP graceful degrade: 부분 실패 시 성공 소스만 표시, 전체 실패 시 "No suggestions available" (T033)
