# GitHub Copilot Usage Records — LinkUp MVP

## Usage Summary

Used GitHub Copilot (Claude Opus 4.6) to implement the LinkUp Map-First MVP.

---

## Case 1: Specification Quality Validation & Gap Resolution

**Context**: spec.md had 23 incomplete pre-flight checklist items

**How Copilot helped**:
- Gap analysis per checklist item (CHK017–CHK039)
- Automated补 completion of missing content in spec.md:
  - Demo Script expanded from 5 to 6 steps (added search filtering)
  - Added search→map visual feedback specification to FR-015
  - Added Action Hint placement/style/click behavior specification to FR-016
  - Added TTL physical deletion and complex auth flows to Non-Goals
  - Quantified MVP auth pass criteria in Assumptions

**Impact**: All 23 items resolved in batch, spec quality achieved 39/39

---

## Case 2: Full-Stack Project Scaffolding

**Context**: Needed to set up Next.js 14 + TypeScript + Tailwind project from an empty directory

**How Copilot helped**:
- Generated package.json, tsconfig.json, tailwind.config.js, postcss.config.js
- Generated full source code based on 47 tasks:
  - Auth.js v5 + Entra ID authentication (auth.ts, middleware.ts, AuthButton)
  - Azure Maps map component (MapView with markers + dimmed states)
  - SQLite DB initialization (better-sqlite3, posts + engagements tables)
  - 3-sentence validation utility (URL/ellipsis exclusion logic)
  - MCP server (3 tools: search_m365, search_posts, action_hint)
  - AI Foundry client (embeddings + chat completions)

**Impact**: 12 source files + 4 API routes + MCP server generated in batch

---

## Case 3: MCP Multi-Source Integration with Graceful Degrade

**Context**: FR-018 requirement — show only successful sources on partial failure, show message on total failure

**How Copilot helped**:
- Used `Promise.allSettled()` pattern in MCP client for independent per-source handling
- Tracked per-source failures via `unavailableSources` array
- Implemented per-category "unavailable" state UI rendering in SuggestionsPanel
- Hidden hint area on Action Hint generation failure

**Impact**: FR-018 partial failure UX fully implemented (per-category graceful degrade)

---

## Case 4: LangGraph Agent Migration (002-langgraph-migration)

**Context**: The manual LLM orchestration loop in `mcp-client.ts` used a hand-rolled `for` loop with raw OpenAI SDK calls, manual tool-call JSON parsing, and lacked wall-clock timeout enforcement. Migrated to a LangGraph `StateGraph`-based agent.

**How Copilot helped**:
- Researched `@langchain/langgraph` v1.1.4 API surface — verified `StateGraph`, `StateSchema`, `MessagesValue`, `ReducedValue`, `ToolNode`, `toolsCondition` availability
- Resolved `@langchain/core` peer dependency conflict (research docs said `^0.3.x` but `@langchain/langgraph@1.1.4` requires `^1.1.16`)
- Verified runtime context pattern: `config.context.mcpClient` (not `config.configurable`) by reading node_modules source
- Created modular agent folder structure (`app/lib/agents/suggestions/`) with 6 files:
  - `types.ts` — `SuggestionsContext`, `SuggestionsState`
  - `prompt.ts` — system prompt with query expansion instructions
  - `tools.ts` — 3 LangChain `tool()` wrappers delegating to MCP `Client.callTool()`
  - `fallback.ts` — hardcoded parallel MCP calls when LLM unavailable
  - `graph.ts` — `StateGraph` with 3 nodes (`llmCall`, `toolExec`, `formatResponse`), conditional edges, deduplication, `Promise.race` timeout, full entry point
  - `index.ts` — barrel re-exports
- Fixed 3 TypeScript errors: `StateGraph` constructor positional args (not `{ stateSchema, contextSchema }`), `SuggestionsContext` changed from `interface` to `type` for index signature compatibility
- Added structured per-node logging (timing, tool names, result counts) and error logging per Constitution 3.3 (no raw user text)

**Architecture decisions**:
- **Graph topology**: `START → llmCall → [shouldContinue] → toolExec ↔ llmCall → formatResponse → END`
- **Agent folder pattern**: `app/lib/agents/{domain}/` with `types`, `prompt`, `tools`, `fallback`, `graph`, `index` — extensible for future agents
- **Backward compatibility**: `mcp-client.ts` removed; API route updated to import the LangGraph suggestions agent from `app/lib/agents/suggestions`
- **Fallback preserved**: `fallbackDirectCalls()` invoked when (1) no LLM env vars, (2) graph throws, (3) wall-clock timeout (30s)
- **`@langchain/core` singleton**: `overrides` in package.json prevents duplicate instances

**Impact**: Manual 200+ line orchestration loop replaced with declarative graph; modular agent pattern established for future agents

---

## Case 5: Pin Text Preview (004-pin-text-preview)

**Context**: Map pins showed only category emoji — users had to tap each pin to read post content. Feature 004 adds glanceable truncated text snippets below pin tails and on cluster markers.

**How Copilot helped**:
- Added `truncateSnippet()` helper — word-boundary truncation at ~40 chars with "…" ellipsis, whitespace normalization, hard-cut fallback for long words
- Extended `buildSpeechBubbleHtml()` with `snippetText` parameter — renders a `<div>` with inline styles (`max-width:120px`, `text-overflow:ellipsis`, `11px` gray text) below the tail triangle; inherits pin opacity
- Extended `buildClusterHtml()` with `snippetText` and `moreCount` — shows newest post's snippet + "+N more" italic label below the cluster count badge
- Implemented `computeSnippetVisibility()` — greedy newest-first occlusion avoidance using pixel-space `SnippetRect` bounding boxes; prevents snippet-to-snippet and snippet-to-pin overlap
- Integrated occlusion pass into `renderMarkers()` — collects solo-pin pixel positions and cluster bounding boxes, then selectively hides occluded snippets
- Search dimming: dimmed pins pass empty `snippetText` (hidden snippet) and are excluded from occlusion input so they don't block visible pins' snippets

**Architecture decisions**:
- All changes in single file `app/components/MapView.tsx` — no new files, API endpoints, or dependencies
- CSS + JS "belt and suspenders" truncation: JS pre-truncates at word boundary, CSS `text-overflow: ellipsis` as visual safety net for wide characters
- Snippet positioned below tail (centered) — natural top-down flow, no `pixelOffset` change needed
- Cluster snippet uses newest post (sorted by `createdAt` desc) — consistent with `ClusterListPanel` sort order
- `pointer-events: none` on snippet div ensures clicks pass through to marker click handler

**Impact**: All 4 user stories implemented — solo pin snippets, cluster previews, occlusion avoidance, and search dimming — in ~80 lines of added code

---

## Case 6: Post Replies & Document Sharing (005-post-replies-docs)

**Context**: Post interactions were limited to Interested/Join buttons. Feature 005 adds text replies and M365 document link sharing to the PostPopup, enabling richer collaboration.

**How Copilot helped**:
- Generated full spec → plan → research → data model → contracts → tasks pipeline using speckit workflow
- Created 2 new SQLite tables (`replies`, `shared_documents`) with `ON DELETE CASCADE` for TTL compliance (Constitution 2.1)
- Implemented 5 new API endpoints:
  - `GET/POST /api/posts/[postId]/replies` — cursor-paginated replies (newest first), create with auth + expiry validation
  - `DELETE /api/posts/[postId]/replies/[replyId]` — author-only delete with 403/404
  - `GET/POST /api/posts/[postId]/shared-documents` — cursor-paginated docs (oldest first), create with auth + expiry + duplicate 409
- Built `RepliesDocumentsPanel` component with:
  - `useReducer` for optimistic reply submission (prepend → swap tempId on success, rollback + preserve input on failure)
  - Stacked sections layout: "💬 Replies (N)" above "📎 Shared Documents (N)" with distinct headers and empty states
  - Keyset cursor pagination with "Load more" buttons and loading spinners
  - Delete own reply button with confirmation dialog
  - Shared document display with source icon + sharer initial circle
- Extended `SuggestionsPanel` with inline "Share" button per M365 item + "Shared ✓" emerald badge for already-shared docs
- Wired cross-component share flow: SuggestionsPanel → PostPopup handler → POST API → RepliesDocumentsPanel re-fetch

**Architecture decisions**:
- Keyset pagination (not OFFSET) — stable under concurrent writes, O(page_size) with composite `(postId, createdAt, id)` indexes
- Composite `createdAt|id` cursor, base64url-encoded — opaque to clients, handles sub-second collisions
- `LIMIT N+1` pattern — avoids separate `COUNT(*)` for `hasMore` detection
- `useReducer` over multiple `useState` — atomic state transitions for optimistic UI (R2.1)
- Separate `useState` for reply input text — keystrokes don't re-render the list; preserved on submission failure (R2.3)
- Stacked sections over tabs — both sections always visible for awareness (R3.4)
- New API routes in separate files following existing `[postId]/` nesting pattern

**Impact**: 4 user stories (text replies, M365 doc sharing, section separation, delete own reply), 4 new files created, 4 existing files modified, 21 tasks completed across 7 phases, zero type errors
