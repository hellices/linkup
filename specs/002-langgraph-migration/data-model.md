# Data Model: LangGraph Agent Migration

**Feature**: 002-langgraph-migration  
**Date**: 2025-02-12

## Overview

This migration introduces a LangGraph `StateSchema`-based agent state. No database schema changes are required — all new entities exist at runtime only. The existing `CombinedSuggestionsResponse`, `McpSuggestion`, `PostSummary`, and related types in `app/types/index.ts` remain unchanged.

## AgentState (LangGraph StateSchema)

The core runtime state managed by the LangGraph `StateGraph`. Defined using `StateSchema` from `@langchain/langgraph`.

```typescript
import { StateSchema, MessagesValue, ReducedValue } from "@langchain/langgraph";
import { z } from "zod/v4";

const AgentState = new StateSchema({
  // Chat message history (LLM ↔ tool exchanges)
  // Built-in reducer: appends new messages, updates existing by ID
  messages: MessagesValue,

  // Number of LLM call rounds completed
  // Reducer: accumulates via addition
  llmCallCount: new ReducedValue(
    z.number().default(0),
    { reducer: (x, y) => x + y }
  ),
});
```

### Fields

| Field | Type | Reducer | Description |
|-------|------|---------|-------------|
| `messages` | `BaseMessage[]` | `MessagesValue` (append/update by ID) | Full conversation history: system prompt, user message, AI messages with tool calls, tool result messages. Drives the LLM tool-use loop. |
| `llmCallCount` | `number` | `(x, y) => x + y` | Tracks how many LLM call rounds have completed. Used by the conditional edge to enforce `MAX_TOOL_ROUNDS`. Starts at 0, incremented by 1 each round. |

### Runtime Context (not part of state)

Passed via LangGraph's `context` configuration at `graph.invoke()` time. Not serialized or checkpointed.

| Field | Type | Description |
|-------|------|-------------|
| `mcpClient` | `Client` | MCP SDK client instance connected via InMemoryTransport. Used by tool wrappers to call `client.callTool()`. |
| `postId` | `string` | Current post ID, passed to `search_posts` as `excludePostId`. |

## MCP Tool Wrappers (LangChain Tools)

Five LangChain `tool()` instances that delegate to the MCP server via `Client.callTool()`. Each wrapper:
1. Defines a Zod input schema matching the MCP tool's schema
2. Accesses the MCP `Client` from runtime context (`config.context.mcpClient`)
3. Calls `client.callTool()` and extracts the text content
4. Returns the text result for the LLM to process

| Wrapper | MCP Tool | Input Schema | Output |
|---------|----------|-------------|--------|
| `searchM365Tool` | `search_m365` | `{ query: string }` | JSON string of `McpSuggestion[]` |
| `searchDocsTool` | `search_docs` | `{ query: string }` | JSON string of `McpSuggestion[]` |
| `searchIssuesTool` | `search_issues` | `{ query: string }` | JSON string of `McpSuggestion[]` |
| `searchPostsTool` | `search_posts` | `{ query: string, excludePostId?: string }` | JSON string of `PostSummary[]` |
| `generateActionHintTool` | `generate_action_hint` | `{ postText: string, searchResults: Array<{title, description, sourceType}> }` | Action hint string |

## Graph Topology

```
START
  │
  ▼
┌──────────┐
│ llmCall  │◄──────────────────┐
└────┬─────┘                   │
     │                         │
     ▼                         │
[shouldContinue?]              │
     │                         │
     ├── has tool_calls AND    │
     │   llmCallCount < MAX ───┤
     │        │                │
     │        ▼                │
     │   ┌────────────┐        │
     │   │ toolExec   │────────┘
     │   └────────────┘
     │
     └── no tool_calls OR
         llmCallCount >= MAX
              │
              ▼
       ┌──────────────┐
       │ formatResp   │
       └──────┬───────┘
              │
              ▼
             END
```

### Node Descriptions

| Node | Type | Input | Output | Description |
|------|------|-------|--------|-------------|
| `llmCall` | `GraphNode<AgentState>` | Current messages | AI message (possibly with tool_calls) + `llmCallCount: 1` | Invokes `AzureChatOpenAI` with all bound tools. System prompt includes query expansion instructions. |
| `toolExec` | `ToolNode` | AI message with tool_calls | Tool result messages | LangGraph prebuilt `ToolNode`. Executes all requested tools in parallel. Handles errors by returning error text as tool results. |
| `formatResponse` | `GraphNode<AgentState>` | Final AI message (no tool_calls) | N/A (returns `Command` or final state) | Parses the LLM's final text into `CombinedSuggestionsResponse`. Validates structure and applies defaults for missing fields. |

### Edge Descriptions

| From | To | Type | Condition |
|------|----|------|-----------|
| `START` | `llmCall` | Normal | Always |
| `llmCall` | `toolExec` or `formatResponse` | Conditional | If `lastMessage.tool_calls?.length > 0` AND `llmCallCount < MAX_TOOL_ROUNDS` → `toolExec`; otherwise → `formatResponse` |
| `toolExec` | `llmCall` | Normal | Always (feed tool results back to LLM) |
| `formatResponse` | `END` | Normal | Always |

## Existing Types (Unchanged)

The following types from `app/types/index.ts` are NOT modified:

- `CombinedSuggestionsResponse` — API response contract
- `McpSuggestion` — Individual suggestion item
- `PostSummary` — Post with engagement counts
- `M365Source` — OneDrive/SharePoint/Email discriminator
- `PostEmbedding` — In-memory embedding cache entry

## State Transitions

```
1. Initial: { messages: [SystemMessage, HumanMessage], llmCallCount: 0 }
2. After llmCall: { messages: [..., AIMessage(tool_calls)], llmCallCount: 1 }
3. After toolExec: { messages: [..., ToolMessage, ToolMessage, ...], llmCallCount: 1 }
4. After llmCall (round 2): { messages: [..., AIMessage(tool_calls)], llmCallCount: 2 }
5. ... (repeat until no tool_calls or MAX reached)
6. After formatResponse: Final CombinedSuggestionsResponse extracted from last AIMessage
```
