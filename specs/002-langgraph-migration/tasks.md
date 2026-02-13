# Tasks: LangGraph Agent Migration

**Input**: Design documents from `/specs/002-langgraph-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contract.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. Each story can be implemented and tested independently after the Foundational phase is complete.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Install LangGraph ecosystem dependencies and configure package.json

- [X] T001 Install `@langchain/langgraph@^1.1.4`, `@langchain/openai@^1.2.7`, `@langchain/core@^1.1.24` and add `overrides` for `@langchain/core` singleton in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the two new files that all user stories depend on — tool wrappers and agent module skeleton

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create 5 LangChain tool wrappers (`searchM365Tool`, `searchDocsTool`, `searchIssuesTool`, `searchPostsTool`, `generateActionHintTool`) with Zod input schemas delegating to `Client.callTool()` via runtime context in app/lib/agents/suggestions/tools.ts
- [X] T003 [P] Create agent skeleton — imports, constants (`MAX_TOOL_ROUNDS=5`, `AGENT_TIMEOUT_MS=30000`, `RECURSION_LIMIT=12`), `SUGGESTIONS_SYSTEM_PROMPT`, and `createModel()` helper that instantiates `AzureChatOpenAI` from env vars in app/lib/agents/suggestions/graph.ts + prompt.ts

**Checkpoint**: Foundation ready — `mcp-tools.ts` exports `createMcpTools()`, `mcp-agent.ts` has constants + model factory

---

## Phase 3: User Story 1 — LLM-Driven Suggestion Retrieval Works Identically (Priority: P1) 🎯 MVP

**Goal**: Replace the manual `for` loop in `mcp-client.ts` with a LangGraph `StateGraph` agent that produces identical `CombinedSuggestionsResponse` output

**Independent Test**: Create a post → open Suggestions panel → verify M365, docs, issues, posts, and action hint all render correctly

### Implementation for User Story 1

- [X] T004 [US1] Define `AgentState` schema with `messages: MessagesValue` and `llmCallCount: ReducedValue(number, add)` in app/lib/agents/suggestions/graph.ts
- [X] T005 [US1] Implement `llmCall` node — invoke `AzureChatOpenAI` with `.bindTools(tools)`, append system prompt + user message, return AI message and increment `llmCallCount` in app/lib/agents/suggestions/graph.ts
- [X] T006 [US1] Implement `shouldContinue` conditional edge — route to `toolExec` if `lastMessage.tool_calls` exists AND `llmCallCount < MAX_TOOL_ROUNDS`, else route to `formatResponse` in app/lib/agents/suggestions/graph.ts
- [X] T007 [US1] Configure prebuilt `ToolNode` with tools from `createMcpTools()` for parallel tool execution in app/lib/agents/suggestions/graph.ts
- [X] T008 [US1] Implement `formatResponse` node — parse LLM's final text into `CombinedSuggestionsResponse`, validate structure, apply defaults for missing fields in app/lib/agents/suggestions/graph.ts
- [X] T009 [US1] Assemble `StateGraph` — add nodes (`llmCall`, `toolExec`, `formatResponse`), add edges (`START→llmCall`, `toolExec→llmCall`, `formatResponse→END`), add conditional edge (`llmCall→shouldContinue`), set `recursionLimit`, compile in app/lib/agents/suggestions/graph.ts
- [X] T010 [US1] Implement `getCombinedSuggestions` entry point — connect MCP via `connectInProcess()`, create tools, invoke compiled graph with runtime context (`mcpClient`, `postId`), return `CombinedSuggestionsResponse` in app/lib/agents/suggestions/graph.ts
- [X] T011 [US1] Convert app/lib/mcp-client.ts to backward-compatible re-export shim (`export { getCombinedSuggestions } from "@/app/lib/agents/suggestions"`)

**Checkpoint**: At this point, `GET /api/posts/{postId}/suggestions` should return identical results via the LangGraph agent path

---

## Phase 4: User Story 2 — Multi-Query Expansion via Graph Nodes (Priority: P1)

**Goal**: Ensure the agent generates 2–3 diverse search queries and deduplicates results from multiple `search_m365` calls

**Independent Test**: Submit a question → verify via console logs that `search_m365` is called ≥2 times with expanded queries (synonyms, related terms) and results contain no duplicates by URL/title

### Implementation for User Story 2

- [X] T012 [US2] Implement `deduplicateResults` utility — merge `McpSuggestion[]` arrays by URL or title, keeping the version with the longer description — in app/lib/agents/suggestions/graph.ts
- [X] T013 [US2] Integrate `deduplicateResults` into `parseAgentOutput` — apply dedup to m365, docs, and issues arrays before building the final response in app/lib/agents/suggestions/graph.ts

**Checkpoint**: Query expansion is driven by the system prompt (T005). Dedup ensures multi-query results are clean.

---

## Phase 5: User Story 3 — Graceful Fallback When AI Foundry Unavailable (Priority: P1)

**Goal**: When LLM is unavailable (missing env vars, LLM exception, or MCP connection failure), automatically fall back to hardcoded parallel MCP tool calls

**Independent Test**: Remove `AZURE_OPENAI_API_KEY` env var → call suggestions API → verify 4 search tools execute in parallel and results are returned

### Implementation for User Story 3

- [X] T014 [US3] Create `fallbackDirectCalls` and `extractToolResultText` helper functions in app/lib/agents/suggestions/fallback.ts and tools.ts
- [X] T015 [US3] Wire fallback triggers in `getCombinedSuggestions` — (1) `createModel()` returns null → skip graph, call fallback; (2) graph.invoke throws → catch and call fallback; (3) timeout → call fallback; (4) MCP `connectInProcess()` throws → return empty response — in app/lib/agents/suggestions/graph.ts

**Checkpoint**: Fallback path fully working — suggestions API never returns 500, always returns valid `CombinedSuggestionsResponse`

---

## Phase 6: User Story 4 — Observable Graph Execution for Debugging (Priority: P2)

**Goal**: Developers can trace node execution order, tool calls, and timing from console logs

**Independent Test**: In dev mode, send a suggestions request → verify console logs show node transitions (e.g., `[LangGraph] Node: llmCall | Step: 1 | Elapsed: 1.2s`), tool call names, and result counts

### Implementation for User Story 4

- [X] T016 [US4] Add structured per-node logging — `llmCall` logs round/tool names/elapsed, `formatResponse` logs result counts — in app/lib/agents/suggestions/graph.ts
- [X] T017 [US4] Add error logging for failed tool calls — log tool name and error message only, no raw user text per Constitution 3.3 — in app/lib/agents/suggestions/tools.ts

**Checkpoint**: Console output provides clear execution trace for debugging without exposing sensitive data

---

## Phase 7: User Story 5 — Timeout Enforcement on Agent Execution (Priority: P2)

**Goal**: Enforce a wall-clock timeout on total agent execution to prevent excessive latency

**Independent Test**: Simulate slow tool responses → verify that after 30s the agent returns partial results or falls back to direct calls

### Implementation for User Story 5

- [X] T018 [US5] Implement `Promise.race` wall-clock timeout — race `graph.invoke()` against a `setTimeout` promise (`AGENT_TIMEOUT_MS`); on timeout, log warning and invoke `fallbackDirectCalls` as recovery — in app/lib/agents/suggestions/graph.ts

**Checkpoint**: Agent execution always completes within `AGENT_TIMEOUT_MS` (default 30s)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation, and cleanup

- [X] T019 [P] Update docs/copilot-notes.md with LangGraph migration architecture decisions and graph topology
- [X] T020 Run `npx tsc --noEmit` type-check validation — fix any type errors across all modified files
- [X] T021 Run quickstart.md E2E validation — `npm run dev`, create a post, verify Suggestions panel renders all categories correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (`npm install` must complete first) — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — core agent implementation
- **US2 (Phase 4)**: Depends on Phase 3 (T008 formatResponse must exist to integrate dedup)
- **US3 (Phase 5)**: Depends on Phase 3 (T010 getCombinedSuggestions must exist to wire fallback)
- **US4 (Phase 6)**: Depends on Phase 3 (node functions must exist to add logging)
- **US5 (Phase 7)**: Depends on Phase 3 + Phase 5 (needs both graph.invoke and fallbackDirectCalls)
- **Polish (Phase 8)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — **MVP target**
- **US2 (P1)**: Depends on US1 (formatResponse node must exist)
- **US3 (P1)**: Depends on US1 (getCombinedSuggestions entry point must exist)
- **US4 (P2)**: Depends on US1 (node functions must exist to instrument)
- **US5 (P2)**: Depends on US1 + US3 (needs graph.invoke + fallback for timeout recovery)

### Within Each User Story

- Models/schemas before node implementations
- Node implementations before graph assembly
- Graph assembly before entry point
- Entry point before re-export shim

### Parallel Opportunities

Within **Phase 2** (Foundational):
- T002 (`mcp-tools.ts`) and T003 (`mcp-agent.ts` skeleton) target different files → run in parallel

After **US1** completes:
- US2 (dedup) and US3 (fallback) can start in parallel — they modify different functions in `mcp-agent.ts`
- US4 (logging) can start in parallel with US2/US3

---

## Parallel Example: Phase 2

```
# Launch both foundational tasks together (different files):
Task T002: "Create 5 LangChain tool wrappers in app/lib/mcp-tools.ts"
Task T003: "Create mcp-agent.ts skeleton with constants and model factory"
```

## Parallel Example: After US1 Complete

```
# These can run in parallel after Phase 3 tasks are done:
Task T012: "Implement deduplicateResults utility in mcp-agent.ts"  (US2)
Task T014: "Migrate fallbackDirectCalls to mcp-agent.ts"           (US3)
Task T016: "Add structured per-node logging in mcp-agent.ts"       (US4)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install dependencies)
2. Complete Phase 2: Foundational (tool wrappers + agent skeleton)
3. Complete Phase 3: User Story 1 (core LangGraph agent)
4. **STOP and VALIDATE**: `npm run dev` → create post → verify Suggestions panel
5. Deploy/demo if ready — agent produces identical output to old loop

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → **MVP!** (identical behavior via LangGraph)
3. Add US2 → Test dedup → Multi-query results are clean
4. Add US3 → Test fallback → System resilient to LLM failures
5. Add US4 → Verify logs → Debugging is transparent
6. Add US5 → Test timeout → Latency bounded
7. Polish → Type-check + E2E → Release ready

---

## Notes

- All implementation is in the `app/lib/agents/suggestions/` module (6 files: types, prompt, tools, fallback, graph, index) + 1 modified shim (`mcp-client.ts`)
- The agent folder pattern (`agents/{domain}/`) is extensible for future agents
- MCP server code (`server.ts`, `tools/*.ts`) is NOT modified
- API response shape (`CombinedSuggestionsResponse`) is NOT modified
- UI components are NOT modified
- The system prompt with query expansion instructions is in `prompt.ts` (US1) since the `llmCall` node needs it from the start
- Commit after each phase checkpoint for safe rollback points
