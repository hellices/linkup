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
  - `tools.ts` — 5 LangChain `tool()` wrappers delegating to MCP `Client.callTool()`
  - `fallback.ts` — hardcoded parallel MCP calls when LLM unavailable
  - `graph.ts` — `StateGraph` with 3 nodes (`llmCall`, `toolExec`, `formatResponse`), conditional edges, deduplication, `Promise.race` timeout, full entry point
  - `index.ts` — barrel re-exports
- Fixed 3 TypeScript errors: `StateGraph` constructor positional args (not `{ stateSchema, contextSchema }`), `SuggestionsContext` changed from `interface` to `type` for index signature compatibility
- Added structured per-node logging (timing, tool names, result counts) and error logging per Constitution 3.3 (no raw user text)

**Architecture decisions**:
- **Graph topology**: `START → llmCall → [shouldContinue] → toolExec ↔ llmCall → formatResponse → END`
- **Agent folder pattern**: `app/lib/agents/{domain}/` with `types`, `prompt`, `tools`, `fallback`, `graph`, `index` — extensible for future agents
- **Backward compatibility**: `mcp-client.ts` becomes a re-export shim; no API route or UI changes needed
- **Fallback preserved**: `fallbackDirectCalls()` invoked when (1) no LLM env vars, (2) graph throws, (3) wall-clock timeout (30s)
- **`@langchain/core` singleton**: `overrides` in package.json prevents duplicate instances

**Impact**: Manual 200+ line orchestration loop replaced with declarative graph; modular agent pattern established for future agents
