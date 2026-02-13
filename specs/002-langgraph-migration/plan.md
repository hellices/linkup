# Implementation Plan: LangGraph Agent Migration

**Branch**: `002-langgraph-migration` | **Date**: 2025-02-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-langgraph-migration/spec.md`

## Summary

Migrate the manual LLM orchestration loop in `app/lib/mcp-client.ts` to a LangGraph `StateGraph`-based agent. The current implementation uses a hand-rolled `for` loop with raw OpenAI SDK calls, manual tool-call JSON parsing, and lacks wall-clock timeout enforcement. The LangGraph migration replaces this with a declarative graph of nodes (query expansion → LLM call → tool execution → deduplication → response formatting), leveraging `@langchain/langgraph`'s `StateSchema`, `MessagesValue`, conditional edges, and `recursionLimit` for execution control. The existing MCP server, tools, fallback path, API contract (`CombinedSuggestionsResponse`), and UI are preserved unchanged.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js (Next.js 14 SSR)  
**Primary Dependencies**: `@langchain/langgraph` ^1.1.4, `@langchain/openai` ^1.2.7, `@langchain/core` ^1.1.24 (NEW); `@modelcontextprotocol/sdk` ^1.26.0, `openai` ^6.21.0 (EXISTING — `openai` SDK retained for embeddings + fallback)  
**Storage**: SQLite via `better-sqlite3` (unchanged); in-memory embedding cache (unchanged)  
**Testing**: Manual E2E via `npm run dev` + Suggestions panel verification; `npx tsc --noEmit` for type-checking  
**Target Platform**: Next.js 14 server-side (API routes, SSR), Windows dev / Linux deploy  
**Project Type**: Web (Next.js monolith — no separate backend/frontend projects)  
**Performance Goals**: Suggestions API response within configurable timeout (default 30s); comparable to existing LLM orchestration latency  
**Constraints**: Must not modify MCP server code (server.ts, tools/*.ts); must not change API response shape; must preserve fallback path; per-tool timeouts inherited from AI Foundry client (15s chat, 10s embeddings)  
**Scale/Scope**: Module replacement (`mcp-client.ts` → `agents/suggestions/`); ~6 new files in agent module + 1 modified shim; 0 UI changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| 1.1 | Lightweight by Design | PASS | Backend-only migration; no UI changes |
| 1.2 | Map-First Interaction | PASS | N/A — no UI impact |
| 1.3 | Connection Over Storage | PASS | No new storage introduced |
| 2.1 | Mandatory TTL | PASS | No data model changes |
| 2.2 | Optional De-identified Summary | PASS | N/A |
| 3.1 | Entra ID Authentication Only | PASS | Auth flow unchanged; accessToken passthrough preserved |
| 3.2 | Minimum-Privilege Principle | PASS | No new permissions; same Graph API scopes |
| 3.3 | Zero Sensitive Data | PASS | Structured logs must not record raw user text — log summaries only (tool names, result counts, timing) |
| 4.1 | MCP as a Core Capability | PASS | MCP tools preserved unchanged |
| 4.2 | Multi-source Knowledge Access | PASS | All 5 sources maintained |
| 4.3 | Transparency | PASS | No UI changes; source attribution preserved |
| 5.1 | Intent-based Participation | PASS | N/A |
| 5.2 | No Heavy Social Graph | PASS | N/A |
| 6.1-6.4 | Rewards & Reputation | PASS | N/A |
| 7.1 | Modular Architecture | PASS | Improved — graph nodes are more modular than monolithic loop; layers (UI/API/MCP) remain separate |
| 7.2 | Observability | PASS | Improved with structured per-node logging; logs must not violate TTL/privacy |
| 8.1 | Spec-Driven Flow | PASS | Following spec → plan → tasks flow |
| 8.2 | Copilot Usage Documentation | PASS | Will document in copilot-notes.md |
| 8.3 | MVP First | PASS | Scoped to single file replacement; no new features |
| 8.4 | English-Only Policy | PASS | All artifacts in English |

**Gate Result**: ALL PASS — no violations. Proceeding to Phase 0.

**Post-Design Re-check (Phase 1)**: ALL PASS — no new violations introduced by data model, contracts, or quickstart design. Modular architecture (7.1) improved by graph decomposition; observability (7.2) improved by structured per-node logging without raw user text.

## Project Structure

### Documentation (this feature)

```text
specs/002-langgraph-migration/
├── plan.md              # This file
├── research.md          # Phase 0 output — LangGraph patterns, decisions
├── data-model.md        # Phase 1 output — AgentState schema
├── quickstart.md        # Phase 1 output — Setup & test instructions
├── contracts/           # Phase 1 output — Internal graph contract (API unchanged)
│   └── api-contract.md  # Internal+external contract documentation
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
app/
├── lib/
│   ├── agents/
│   │   └── suggestions/           # NEW: LangGraph agent module (modular pattern)
│   │       ├── types.ts           # SuggestionsContext, SuggestionsState
│   │       ├── prompt.ts          # SUGGESTIONS_SYSTEM_PROMPT constant
│   │       ├── tools.ts           # 5 LangChain tool() wrappers for MCP tools
│   │       ├── fallback.ts        # Hardcoded parallel MCP calls (no LLM)
│   │       ├── graph.ts           # StateGraph definition, nodes, edges, entry point
│   │       └── index.ts           # Barrel re-exports (getCombinedSuggestions)
│   ├── mcp-client.ts          # MODIFIED: re-exports getCombinedSuggestions from agents/suggestions
│   ├── ai-foundry.ts          # UNCHANGED (embeddings + fallback chat client)
│   └── mcp/
│       ├── server.ts          # UNCHANGED
│       └── tools/             # UNCHANGED
│           ├── search-m365.ts
│           ├── search-docs.ts
│           ├── search-issues.ts
│           ├── search-posts.ts
│           └── action-hint.ts
├── api/
│   └── posts/[postId]/
│       └── suggestions/
│           └── route.ts       # UNCHANGED (calls getCombinedSuggestions)
├── components/
│   └── SuggestionsPanel.tsx   # UNCHANGED
└── types/
    └── index.ts               # UNCHANGED
```

**Structure Decision**: Single web application (Next.js monolith). New files organized under `app/lib/agents/suggestions/` using a modular agent pattern (types, prompt, tools, fallback, graph, index). `mcp-client.ts` becomes a thin re-export shim for backward compatibility. The `agents/{domain}/` pattern is extensible for future agents.

## Complexity Tracking

No constitution violations to justify.
