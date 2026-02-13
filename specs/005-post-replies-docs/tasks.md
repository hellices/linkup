# Tasks: Post Replies & Document Sharing

**Input**: Design documents from `/specs/005-post-replies-docs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Types, DB migration, and shared infrastructure

- [x] T001 Add Reply, SharedDocument, and PaginatedResponse types in app/types/index.ts
- [x] T002 Add replies and shared_documents table creation + indexes in app/lib/db.ts

**Checkpoint**: New tables auto-created on next dev server restart; types available for import

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API routes that ALL user stories depend on — replies CRUD, shared-documents CRUD, and the UI container panel

**⚠️ CRITICAL**: No user story UI work can begin until these API routes exist

- [x] T003 Implement GET /api/posts/[postId]/replies with cursor pagination in app/api/posts/[postId]/replies/route.ts
- [x] T004 Implement POST /api/posts/[postId]/replies (create reply, auth + expiry validation) in app/api/posts/[postId]/replies/route.ts
- [x] T005 Implement GET /api/posts/[postId]/shared-documents with cursor pagination in app/api/posts/[postId]/shared-documents/route.ts
- [x] T006 Implement POST /api/posts/[postId]/shared-documents (share document, auth + expiry + duplicate 409) in app/api/posts/[postId]/shared-documents/route.ts
- [x] T007 Implement DELETE /api/posts/[postId]/replies/[replyId] (author-only, 403/404) in app/api/posts/[postId]/replies/[replyId]/route.ts

**Checkpoint**: All 5 API endpoints functional; can be tested via curl

---

## Phase 3: User Story 1 — Write a Text Reply on a Post (Priority: P1) 🎯 MVP

**Goal**: Signed-in users can write text replies (1–500 chars) on non-expired posts. Replies appear in a "Replies" section with author, timestamp, and "Load more" pagination.

**Independent Test**: Sign in → open any post → type a reply → press send → verify it appears at the top of the replies list immediately.

### Implementation for User Story 1

- [x] T008 [US1] Create RepliesDocumentsPanel component with stacked sections layout, replies useReducer state, and "Load more" pagination in app/components/RepliesDocumentsPanel.tsx
- [x] T009 [US1] Implement reply input form with 500-char limit, send button, sign-in prompt (FR-005), and expired-post disable (FR-006) in app/components/RepliesDocumentsPanel.tsx
- [x] T010 [US1] Implement optimistic reply submission — prepend to list on submit, swap tempId on success, rollback + preserve input on failure (FR-014) in app/components/RepliesDocumentsPanel.tsx
- [x] T011 [US1] Integrate RepliesDocumentsPanel into PostPopup below engagement buttons, passing post, session, and isExpired props in app/components/PostPopup.tsx

**Checkpoint**: User Story 1 fully functional — users can create replies, see them with author/timestamp, paginate with "Load more", and get proper disabled states for unauthenticated/expired scenarios

---

## Phase 4: User Story 2 — Share an M365 Document Link (Priority: P2)

**Goal**: Signed-in users can share M365 documents from MCP Suggestions onto a post. Shared documents appear in the "Shared Documents" section with sharer name, timestamp, and source icon. Duplicates are prevented.

**Independent Test**: Click "Share" on an M365 document in Suggestions → verify it appears in "Shared Documents" section → verify button changes to "Shared ✓".

### Implementation for User Story 2

- [x] T012 [US2] Add "Share" button to M365 suggestion items in SuggestionsPanel, with onShare callback and already-shared "Shared ✓" disabled state in app/components/SuggestionsPanel.tsx
- [x] T013 [US2] Implement Shared Documents section in RepliesDocumentsPanel — fetch, display with source icon + sharer initial circle, "Load more" pagination in app/components/RepliesDocumentsPanel.tsx
- [x] T014 [US2] Wire share flow — SuggestionsPanel onShare → POST shared-documents API → update shared docs list + cross-reference for duplicate prevention in app/components/PostPopup.tsx

**Checkpoint**: User Stories 1 AND 2 both work independently — replies and document sharing are visually separated, paginated, and functional

---

## Phase 5: User Story 3 — Section Separation & Pagination (Priority: P2)

**Goal**: "Replies" and "Shared Documents" sections are visually distinct with section headers showing counts, and each section independently paginates.

**Independent Test**: Open a post with 6+ replies → verify 5 shown + "Load more" → click "Load more" → verify remaining load and button disappears.

> Note: Most of this work is already embedded in T008/T009/T013 (RepliesDocumentsPanel). This phase handles polish and edge cases.

### Implementation for User Story 3

- [x] T015 [US3] Add section headers with counts (💬 Replies (N) / 📎 Shared Documents (N)) and empty-state messages in app/components/RepliesDocumentsPanel.tsx
- [x] T016 [US3] Add loading spinner for initial fetch and "Load more" button loading state in app/components/RepliesDocumentsPanel.tsx

**Checkpoint**: All sections visually distinct, counts displayed, empty states handled, pagination smooth with loading indicators

---

## Phase 6: User Story 4 — Delete Own Reply (Priority: P3)

**Goal**: Reply authors can delete their own replies via a delete button with confirmation dialog.

**Independent Test**: Create a reply → verify delete button on own reply → click → confirm → verify removed from list. Verify no delete button on other users' replies.

### Implementation for User Story 4

- [x] T017 [US4] Add delete button (visible only on own replies) with confirmation dialog and DELETE API call in app/components/RepliesDocumentsPanel.tsx
- [x] T018 [US4] Add DELETE_SUCCESS action to replies reducer — remove reply from items array and decrement count in app/components/RepliesDocumentsPanel.tsx

**Checkpoint**: Full reply lifecycle — create, read, paginate, delete — all working

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [x] T019 [P] Run npx tsc --noEmit and fix any type errors across all modified files
- [x] T020 [P] Run quickstart.md verification steps end-to-end per specs/005-post-replies-docs/quickstart.md
- [x] T021 [P] Update docs/copilot-notes.md with implementation notes per Constitution 8.2

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types + DB tables must exist)
- **US1 (Phase 3)**: Depends on Phase 2 (replies API must exist)
- **US2 (Phase 4)**: Depends on Phase 2 (shared-documents API must exist) + Phase 3 (RepliesDocumentsPanel must exist as the container)
- **US3 (Phase 5)**: Depends on Phase 3 + Phase 4 (both sections must be rendered to polish layout)
- **US4 (Phase 6)**: Depends on Phase 3 (reply rendering must exist) + T007 (DELETE API)
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no story dependencies. Creates the RepliesDocumentsPanel component.
- **US2 (P2)**: Depends on US1 completing T008 (RepliesDocumentsPanel must exist to add shared-documents section). Can run in parallel with US1 API work.
- **US3 (P2)**: Polish pass over US1 + US2 UI — depends on both section renders existing.
- **US4 (P3)**: Only depends on US1 reply rendering + T007 DELETE route. Independent of US2/US3.

### Within Each User Story

- API routes before UI components (Foundational → Story UI)
- State management before interaction handlers
- Core rendering before polish/edge cases

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel (different files)
- T003 + T004 (replies route) and T005 + T006 (shared-docs route) and T007 (delete route) — all [P] different files
- T019, T020, T021 (Polish) — all [P] independent tasks
- US4 can run in parallel with US2/US3 once US1 is complete

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational API routes (T003–T007)
3. Complete Phase 3: User Story 1 — Text Replies (T008–T011)
4. **STOP and VALIDATE**: Test reply creation, pagination, disabled states
5. Deploy/demo if ready — replies alone deliver significant value

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 (T008–T011) → MVP: text replies working → Deploy/Demo
3. Add US2 (T012–T014) → M365 document sharing working → Deploy/Demo
4. Add US3 (T015–T016) → Section polish + empty states → Deploy/Demo
5. Add US4 (T017–T018) → Delete own reply → Deploy/Demo
6. Phase 7 → Type-check, E2E validation, docs

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- No new npm dependencies required
- DB tables auto-migrate on `getDb()` call — restart dev server to apply
- Cursor pagination uses base64url-encoded `createdAt|id` composite (research R1)
- Optimistic UI uses `useReducer` pattern (research R2)
- Share button UX uses inline trailing button with "Shared ✓" disabled state (research R3)
- All data cascade-deletes with the parent post on TTL expiry (Constitution 2.1)
