# Research: LangGraph Agent Migration

**Feature**: 002-langgraph-migration  
**Date**: 2025-02-12  
**Purpose**: Resolve all technical unknowns before Phase 1 design

## R1: LangGraph StateGraph vs. Manual Tool-Use Loop

**Decision**: Use `StateGraph` from `@langchain/langgraph` with explicit nodes and conditional edges.

**Rationale**:
- The current implementation uses a hand-rolled `for` loop (max 5 rounds) with raw OpenAI SDK `chat.completions.create()` calls, manual JSON parsing of tool call arguments, and manual construction of `role: "tool"` messages. This is brittle (regex-based JSON extraction), hard to debug (flat console.log statements), and lacks wall-clock timeout.
- LangGraph's `StateGraph` provides: declarative node/edge definitions, built-in `recursionLimit` for loop bounding, typed state management via `StateSchema`, and structured execution metadata (`config.metadata.langgraph_node`, `langgraph_step`).
- The graph pattern makes each processing step (query expansion, search, deduplication, formatting) an independently testable unit.

**Alternatives considered**:
- **Keep manual loop + add timeout**: Minimal change, but doesn't address structural issues (brittle JSON parsing, poor debuggability, tight coupling to OpenAI SDK types).
- **LangChain `createReactAgent`**: Higher-level abstraction, but too opinionated — it assumes a single agent loop pattern. Our flow needs explicit query expansion + dedup nodes that don't fit the standard ReAct cycle.
- **LangGraph Functional API**: Lighter weight but loses the visual graph structure and doesn't support `addConditionalEdges` patterns as cleanly.

## R2: Azure OpenAI Integration via @langchain/openai

**Decision**: Use `AzureChatOpenAI` from `@langchain/openai` for the LangGraph agent's LLM calls. Retain the existing direct `openai` SDK for embeddings and the fallback path.

**Rationale**:
- `@langchain/openai` provides `AzureChatOpenAI` which accepts `azureOpenAIApiKey`, `azureOpenAIApiInstanceName`, `azureOpenAIApiDeploymentName`, and `azureOpenAIApiVersion` — mapping directly to our existing `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` env vars.
- The LangGraph `StateGraph` nodes require LangChain-compatible chat models (implementing `BaseChatModel`) for `.bindTools()` and message handling. The raw `openai` SDK doesn't satisfy this interface.
- Keeping the existing `openai` SDK for embeddings (`generateEmbedding()` in `ai-foundry.ts`) avoids unnecessary refactoring of the embedding pipeline and fallback chat path.

**Alternatives considered**:
- **Wrap raw OpenAI SDK in LangChain adapter**: Possible but fragile and not officially supported.
- **Replace all OpenAI SDK usage with @langchain/openai**: Over-scoped for this migration; embeddings work fine with the raw SDK.

## R3: MCP Tool Wrapping Strategy

**Decision**: Create LangChain `tool()` wrappers in a separate `mcp-tools.ts` file that delegate to the MCP `Client.callTool()` method. The MCP `Client` instance is passed via LangGraph's runtime `context`.

**Rationale**:
- LangGraph's `ToolNode` and `model.bindTools()` require LangChain `StructuredTool` instances (created via `tool()` from `@langchain/core/tools`).
- Each wrapper defines a Zod schema matching the MCP tool's input schema and calls `client.callTool()` internally, parsing the text content from the MCP response.
- The MCP `Client` cannot be part of `StateSchema` (it's not serializable). LangGraph's `contextSchema` allows passing runtime dependencies like the MCP client without polluting the state.
- The 5 existing MCP tools map to 5 LangChain tool wrappers. The MCP server code (`server.ts`, `tools/*.ts`) remains completely unchanged.

**Alternatives considered**:
- **Re-implement tool logic directly in LangChain tools**: Duplicates existing MCP tool code and loses the MCP server abstraction.
- **Use LangGraph's built-in MCP support (if any)**: LangGraph doesn't have native MCP integration — the `@langchain/openai` `tools.mcp()` is for OpenAI's remote MCP, not for local in-process MCP servers.
- **Pass MCP Client via state**: Not viable — `Client` is not serializable and shouldn't be part of the graph state.

## R4: Graph Architecture Design

**Decision**: 5-node graph with conditional edges for the tool-use loop.

```
START → llmCall → [conditional: has tool_calls?]
                    ├── YES → toolExecution → llmCall (loop)
                    └── NO  → formatResponse → END
```

**Rationale**:
- **llmCall node**: Invokes `AzureChatOpenAI` with bound tools and the system prompt (including query expansion instructions). The LLM decides which tools to call.
- **toolExecution node**: Uses LangGraph's prebuilt `ToolNode` to execute all tool calls in parallel. Handles errors gracefully (returns error messages as tool results).
- **formatResponse node**: Parses the LLM's final text response into `CombinedSuggestionsResponse`. This replaces the brittle regex-based JSON extraction with structured parsing + validation.
- **Conditional edge** (`shouldContinue`): Routes back to `llmCall` if tool calls exist, or to `formatResponse` if the LLM has produced its final answer.
- **Round limiting**: Use `recursionLimit` (set to ~12 to allow 5 LLM↔tool round-trips, since each round = 2 super-steps: llmCall + toolExecution).

**Alternatives considered**:
- **Separate queryExpansion and deduplication nodes**: More explicit but adds complexity. The LLM naturally handles query expansion (via system prompt) and deduplication (via instructions) within the tool-use loop. Keeping these as LLM responsibilities (not separate nodes) preserves the existing behavior while being simpler.
- **Single monolithic node**: Defeats the purpose of using LangGraph.

## R5: Timeout Implementation

**Decision**: Wrap the `graph.invoke()` call in `Promise.race()` with a configurable timeout (default 30 seconds). On timeout, fall back to direct MCP calls.

**Rationale**:
- LangGraph doesn't have a built-in wall-clock timeout for `invoke()`. The `recursionLimit` only caps the number of super-steps, not elapsed time.
- `Promise.race([graph.invoke(...), timeoutPromise])` provides a clean wall-clock timeout. If the timeout fires first, the function falls back to `fallbackDirectCalls()` (the existing hardcoded parallel path).
- The 30s default is chosen because: Azure OpenAI has a 15s per-call timeout, and a typical flow involves 2-3 LLM calls + tool executions. 30s allows normal flows to complete while catching pathological cases.

**Alternatives considered**:
- **AbortController signal**: LangGraph's `invoke()` doesn't support abort signals natively.
- **Per-node timeout**: More granular but harder to implement and unnecessary — the Azure OpenAI client already has per-call timeouts (15s chat, 10s embeddings).

## R6: Fallback Path Preservation

**Decision**: Keep the existing `fallbackDirectCalls()` function unchanged. It is invoked when: (1) `AzureChatOpenAI` cannot be instantiated (missing env vars), (2) the LangGraph agent throws/returns null, or (3) the wall-clock timeout fires.

**Rationale**:
- The fallback path is a critical reliability mechanism (FR-008). It provides degraded but functional results without LLM orchestration.
- The fallback code is well-tested and handles `Promise.allSettled()` + partial failure tracking. No reason to rewrite it.

**Alternatives considered**:
- **Remove fallback after migration**: Risky — external LLM services can fail.
- **Rewrite fallback as a LangGraph subgraph**: Over-engineered — the fallback is deliberately simple (no LLM, just parallel tool calls).

## R7: Structured Logging Approach

**Decision**: Add timing wrappers around each graph node using `config.metadata` to log node name, step number, elapsed time, and result summaries (counts, not raw data).

**Rationale**:
- LangGraph provides `config.metadata.langgraph_node` and `config.metadata.langgraph_step` automatically. We supplement this with `performance.now()` timing.
- Logs record: `[LangGraph] Node: llmCall | Step: 2 | Tools requested: [search_m365, search_docs] | Elapsed: 1.2s`.
- Per Constitution 3.3, logs MUST NOT record raw user input or raw tool output. Only tool names, result counts, and timing are logged.

**Alternatives considered**:
- **LangSmith tracing**: Out of scope per spec assumptions. Can be added later by providing a `LangSmithCallbackHandler`.
- **No logging**: Misses the debugging improvement goal (FR-010, SC-004).

## R8: Dependency Version Compatibility

**Decision**: Pin `@langchain/langgraph` ^1.1.4, `@langchain/openai` ^1.2.7, `@langchain/core` ^0.3.x. Add `overrides` to `package.json` to ensure single `@langchain/core` instance.

**Rationale**:
- LangChain ecosystem requires all packages to share the same `@langchain/core` instance. The `overrides` field in `package.json` prevents version conflicts.
- `@langchain/langgraph` 1.1.4 uses the new `StateSchema` API (replaces older `Annotation` API). The `StateSchema` + `MessagesValue` + `ReducedValue` pattern is the current recommended approach.
- `zod` ^4.x is already in the project and is compatible with latest LangGraph (which uses `zod/v4`).

**Alternatives considered**:
- **Use older LangGraph API (Annotation-based)**: Deprecated in favor of `StateSchema`. No benefit.
