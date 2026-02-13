# Research: Post Replies & Document Sharing

**Feature**: `005-post-replies-docs`  
**Date**: 2026-02-13

## R1 — Cursor-Based Pagination with SQLite

### R1.1 Cursor Value

- **Decision**: Composite `createdAt|id` pair, base64url-encoded into an opaque cursor string.
- **Rationale**: `createdAt` is already stored as sortable ISO 8601 TEXT in SQLite. Adding `id` (UUID) as a tie-breaker handles sub-second collisions. Base64url encoding makes the cursor opaque to clients.
- **Alternatives considered**: `rowid` (leaks DB internals, breaks on migration), `LIMIT+OFFSET` (see R1.3).

### R1.2 Efficient "Load More" Query

- **Decision**: Keyset pagination with `WHERE` filter on cursor columns + `LIMIT N+1` (fetch 6, return 5, use the 6th as `hasMore` signal).
- **Rationale**: Avoids separate `COUNT(*)` query. With a composite index `(postId, createdAt, id)`, SQLite performs a direct B-tree seek — O(page_size) regardless of total rows.
- **Alternatives considered**: Separate `COUNT(*)` (extra full scan), client-side pagination (defeats purpose for 50+ items).

### R1.3 OFFSET vs. Keyset Pagination

- **Decision**: Keyset (cursor) pagination. No `LIMIT+OFFSET`.
- **Rationale**: OFFSET requires SQLite to scan and discard rows linearly (O(offset + limit)). Under concurrent writes (new replies added between page loads), OFFSET causes duplicates or gaps. Keyset pagination is stable, O(page_size), and correct under concurrent writes.
- **Alternatives considered**: `LIMIT+OFFSET` (inconsistent, O(offset)), client-side paginate-all (fails at scale).

### R1.4 SQL Query Pattern

```sql
-- First page: no cursor
SELECT id, postId, authorId, authorName, text, createdAt
FROM replies WHERE postId = ?
ORDER BY createdAt DESC, id DESC
LIMIT 6;

-- Next page: with cursor (createdAt, id)
SELECT id, postId, authorId, authorName, text, createdAt
FROM replies
WHERE postId = ?
  AND (createdAt < ? OR (createdAt = ? AND id < ?))
ORDER BY createdAt DESC, id DESC
LIMIT 6;
```

For shared documents (chronological order), flip operators: `>` instead of `<`, `ASC` instead of `DESC`.

### R1.5 Response Shape

- **Decision**: `{ items: T[], nextCursor: string | null, hasMore: boolean }`
- **Rationale**: `hasMore` is explicit (avoids null-checking), `nextCursor` is opaque, no `totalCount` (expensive, unnecessary for "Load more" UX), no `prevCursor` (forward-only appending).
- **Alternatives considered**: `{ data, meta: { cursor, hasMore } }` (over-nested), `Link` header (harder to consume in React fetch).

### R1.6 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_replies_post_created ON replies(postId, createdAt DESC, id);
CREATE INDEX IF NOT EXISTS idx_shared_docs_post_created ON shared_documents(postId, createdAt ASC, id);
```

---

## R2 — Optimistic UI for Reply Submission

### R2.1 State Management

- **Decision**: `useReducer` with typed `RepliesState` / `RepliesAction` for the reply list; separate `useState` for the input text.
- **Rationale**: Reply list state has coupled transitions (insert optimistic entry + set pending flag, or remove entry + set error). `useReducer` makes these atomic. Input text state is separate so keystroke re-renders don't affect the list.
- **Alternatives considered**: Multiple `useState` (tearing risk on concurrent sets), `useOptimistic` (React 19 only — app uses React 18.3), React Query (no cache layer in current codebase).

### R2.2 Pending Visual Treatment

- **Decision**: Semi-transparent card (`opacity-50 animate-pulse pointer-events-none`) with "Sending…" label.
- **Rationale**: Preserves the user's text visually (confidence it was captured) while signaling pending state. Matches existing `disabled:opacity-40` pattern on engagement buttons.
- **Alternatives considered**: Spinner (hides content), toast only (no positional feedback), skeleton (implies loading from server).

### R2.3 Rollback on Failure

- **Decision**: On failure, remove the optimistic entry from the list but preserve input text (which lives in a separate `useState`). User can retry immediately.
- **Rationale**: Decoupled state: input `useState` is untouched on failure; reducer's `SUBMIT_FAILURE` action atomically removes the optimistic entry and sets the error string.
- **Alternatives considered**: Clear input on submit + restore from ref on failure (fragile), keep optimistic entry with "Retry" button (adds complexity).

### R2.4 Merge with Paginated List

- **Decision**: Prepend optimistic reply to `items[0]` (newest-first). Cursor state is unaffected because "Load more" appends older items to the end. On `SUBMIT_SUCCESS`, swap `tempId` with server-confirmed `id`.
- **Rationale**: The optimistic entry is by definition the newest; it sits outside any cursor window. No deduplication needed.
- **Alternatives considered**: Refetch first page (destroys "Load more" state, adds latency), separate `optimisticItems` array (complex merge on render).

### R2.5 Prepend vs. Refetch

- **Decision**: Prepend to local state. No refetch.
- **Rationale**: App uses raw `fetch` with no cache layer. Refetching would discard already-loaded "Load more" pages and show a loading spinner, defeating optimistic UI. No multi-client real-time sync concern in current architecture.
- **Alternatives considered**: Refetch + merge (complex without library support), SWR invalidation (would require new dependency).

---

## R3 — Document Sharing UX Patterns

### R3.1 Share Button Placement

- **Decision**: Inline trailing icon-button on the same row as the M365 document title, right-aligned.
- **Rationale**: Co-locates action with its target (Fitts's Law); matches existing compact `space-y-1` layout in SuggestionsPanel. Avoids breaking left-to-right read flow.
- **Alternatives considered**: Below-description (adds vertical bulk), hover-reveal (poor touch discoverability), context menu (too hidden).

### R3.2 Duplicate Prevention UX

- **Decision**: Disable the Share button at render time and replace label with "Shared ✓" when the URL already exists in the shared documents list. On race condition (409 from API), show subtle inline message "Already shared."
- **Rationale**: Proactive prevention via state comparison at render avoids wasted clicks. Matches existing `disabled:opacity-40` pattern. No toast system exists in the codebase.
- **Alternatives considered**: Toast (no toast infra), modal (too disruptive), hide shared items (loses useful context).

### R3.3 Already-Shared State in Suggestions Panel

- **Decision**: Show "Shared ✓" badge in emerald green replacing the Share button.
- **Rationale**: Visual cross-reference between shared documents list and suggestions. Green tint (`text-emerald-500`) matches the app's mint success color. Pattern matches "My post" muted display in PostPopup.
- **Alternatives considered**: Strikethrough (implies invalid), hide item (removes context), keep button enabled (wastes click, spec says "prevent").

### R3.4 Section Separation Pattern

- **Decision**: Stacked sections with distinct headers, "Replies" above "Shared Documents", both within the existing scrollable PostPopup column.
- **Rationale**: Tabs would hide one section (bad for awareness). Collapsible accordions add interaction cost. Stacked sections with clear headers (e.g., `💬 Replies (7)` / `📎 Shared Documents (3)`) maintain the existing scroll-based layout. Replies first because they are higher-frequency (P1).
- **Alternatives considered**: Tabs (hide content, poor awareness), collapsible (hidden by default = low discoverability), interleaved timeline (mixes types, spec requires visual separation).

### R3.5 Sharer Identity Display

- **Decision**: Small colored initial circle (`w-5 h-5`) + name text, matching the existing PostPopup author pattern at a smaller scale.
- **Rationale**: Reuses the existing gradient initial circle pattern from PostPopup author display. Provides visual anchor for scanning. Full avatars not available in current data model.
- **Alternatives considered**: Name-only (flat, hard to scan), full avatar (requires new infrastructure), no attribution (violates FR-009).

---

## Summary

| # | Topic | Decision |
|---|-------|----------|
| R1.1 | Cursor value | Composite `createdAt\|id`, base64url-encoded |
| R1.2 | Load more query | Keyset WHERE + LIMIT N+1; composite index |
| R1.3 | Pagination type | Keyset/cursor (not OFFSET) |
| R1.4 | SQL pattern | `(createdAt < ? OR (createdAt = ? AND id < ?))` with DESC/ASC per section |
| R1.5 | Response shape | `{ items, nextCursor, hasMore }` |
| R1.6 | Indexes | Composite `(postId, createdAt, id)` per table |
| R2.1 | State management | `useReducer` for list, `useState` for input |
| R2.2 | Pending visual | Semi-transparent + animate-pulse + "Sending…" |
| R2.3 | Rollback | Remove optimistic entry, preserve input text |
| R2.4 | Merge strategy | Prepend to items[0], swap tempId on success |
| R2.5 | Prepend vs refetch | Prepend to local state, no refetch |
| R3.1 | Share button | Inline trailing icon-button |
| R3.2 | Duplicate UX | Disabled "Shared ✓" at render + 409 inline message |
| R3.3 | Already-shared state | Emerald "Shared ✓" badge replacing button |
| R3.4 | Section layout | Stacked sections with distinct headers |
| R3.5 | Sharer identity | Small initial circle + name |
