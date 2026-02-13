# MCP Server Architecture — LinkUp MVP

## Overview

LinkUp's MCP server runs in the **same process** as the Next.js app,
and MCP Client ↔ McpServer are directly connected via `InMemoryTransport`.
Without a separate sidecar process or HTTP communication, it can directly access app memory (PostEmbedding cache).

**LLM-Driven Tool Orchestration (FR-023)**: The app does not hardcode MCP tools;
the LLM (GPT-4o-mini) discovers tools via `listTools()` and decides which ones to call.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                Next.js App (:3000) — Single Process       │
│                                                          │
│  ┌─────────────┐   ┌────────────────┐                    │
│  │ PostPopup   │   │ SearchBar      │                    │
│  │ Component   │   │ Component      │                    │
│  └──────┬──────┘   └───────┬────────┘                    │
│         │                   │                             │
│  ┌──────▼──────┐   ┌───────▼────────┐                    │
│  │ /api/posts/ │   │ /api/search    │                    │
│  │ [id]/       │   │ (AI Foundry    │                    │
│  │ suggestions │   │  embeddings +  │                    │
│  └──────┬──────┘   │  PostEmbedding │                    │
│         │           │  cache)        │                    │
│  ┌──────▼──────────────────┐ └──────┘                    │
│  │    MCP Client           │                             │
│  │  (mcp-client.ts)        │                             │
│  │                         │                             │
│  │  1. connectInProcess()  │                             │
│  │     InMemoryTransport   │                             │
│  │  2. listTools() ──────────────► McpServer (in-proc)   │
│  │  3. tools → OpenAI fn   │                             │
│  │  4. GPT-4o-mini ◄─┐     │                             │
│  │     "which tools?" │     │                             │
│  │  5. tool_calls ────┘     │                             │
│  │  6. callTool() ──────────────► McpServer tools        │
│  │  7. results → LLM       │                             │
│  │  8. structured JSON      │                             │
│  └──────────┬──────────────┘                             │
│             │                                             │
│  ┌──────────▼─────────────────────────────────┐          │
│  │        McpServer (app/lib/mcp/server.ts)   │          │
│  │                                            │          │
│  │  ┌──────────────────────────────────┐      │          │
│  │  │ Shared AI Foundry Client         │      │          │
│  │  │ (app/lib/ai-foundry.ts)          │      │          │
│  │  │ ├─ embeddings (text-embedding-   │      │          │
│  │  │ │   3-small)                     │      │          │
│  │  │ └─ chat (gpt-4o-mini)           │      │          │
│  │  └──────────────┬──────────────────┘      │          │
│  │                 │                          │          │
│  │  ┌──────────────────┐ ┌─────────────┐     │          │
│  │  │ search_m365      │ │search_posts │     │          │
│  │  │ Graph Search API │ │direct memory│     │          │
│  │  │ (OneDrive/SP/    │ │getAllEmbed() │     │          │
│  │  │  Email)          │ │             │     │          │
│  │  └──────────────────┘ └─────────────┘     │          │
│  │  ┌──────────────────┐                     │          │
│  │  │ gen_action_hint  │                     │          │
│  │  │ GPT-4o-mini      │                     │          │
│  │  └──────────────────┘                     │          │
│  └────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

## LLM-Driven Tool Orchestration (FR-023)

**Why**: The core value of MCP is dynamically discovering and selecting tools.
If the app hardcodes tool names, MCP is merely a simple RPC wrapper.
The LLM must discover tools via `listTools()` and decide which tools to
call based on the situation — that is the true MCP pattern.

**Flow**:
```
1. connectInProcess() → Connect Client ↔ McpServer via InMemoryTransport
2. MCP Client → listTools() → Obtain list of available tools
3. MCP tool schemas → Convert to OpenAI function-calling format
4. Send (system prompt + post text + tool list) to GPT-4o-mini
5. LLM returns tool_calls → Execute on McpServer via callTool()
6. Tool results → Feed back to LLM
7. LLM returns final structured JSON (m365/posts/actionHint)
8. Parse into CombinedSuggestionsResponse
```

**Fallback**: When AI Foundry is unavailable, falls back to the existing hardcoded parallel calls pattern.

## Architecture Decision: In-Process MCP (InMemoryTransport)

**Why**:
- When separating into a sidecar process, `search_posts` cannot directly access the app's PostEmbedding cache → requires HTTP callback → increases complexity
- Need to resolve `McpServer.connect()` per-request issue ("Already connected to a transport") → requires creating a new server instance per request
- Eliminates duplicate AI Foundry client instances (one in app + one in MCP server)
- Removes port management (3001), CORS, and process management overhead

**InMemoryTransport**: Uses `InMemoryTransport.createLinkedPair()` provided by the MCP SDK to
directly connect Client and Server within the same process. Message passing in memory without network I/O.

**Data Flow**:
- `search_m365`: Calls Microsoft Graph Search API with user's access token → OneDrive files, SharePoint docs, Outlook emails
- `search_posts`: Directly accesses the PostEmbedding cache via `getAllEmbeddings()` → cosine similarity → DB lookup (**HTTP callback eliminated**)
- `generate_action_hint`: Directly uses the app's `getOrchestrationClient()` + `getChatDeploymentName()`

**Environment Variables**: Since it runs in a single process, only one set of `AZURE_OPENAI_*` environment variables needs to be configured.

## Multi-Source Value

Why MCP is a "feature", not just a wrapper:

1. **LLM-Driven Tool Selection**: The LLM analyzes the post content and autonomously
   decides which tools to call. When new tools are added, they are automatically discovered
   by simply registering them in the McpServer without modifying app code.

2. **M365 Internal Search**: Searches OneDrive files, SharePoint documents, and Outlook emails
   via Microsoft Graph Search API — the primary source for internal knowledge.

3. **M365 + Posts Combined**: The LLM decides to search M365 internal resources
   and similar posts simultaneously or selectively, and displays results by category.

4. **Action Hint (GPT-4o-mini)**: Based on search results, GPT-4o-mini suggests a concrete next action
   in one line (e.g., "Check Step 2 first"). Falls back to template when AI Foundry is unavailable.

5. **Direct Memory Access**: `search_posts` directly accesses the PostEmbedding cache to
   search for similar posts in real-time without HTTP callbacks. Minimizes latency.

6. **Graceful Degrade**: LLM orchestration failure → hardcoded fallback.
   On partial failure, only successful sources are displayed; failed sources show "unavailable". On AI Foundry embedding failure, returns all data as fallback.

## Tools

| Tool | Input | Output | AI Usage | Source |
|------|-------|--------|---------|--------|
| `search_m365` | query string | McpSuggestion[] (max 10) | Microsoft Graph Search API | OneDrive + SharePoint + Email (live) |
| `search_posts` | query string, excludePostId? | McpSuggestion[] (max 5) | embed(query) → cosine | Direct PostEmbedding cache access |
| `generate_action_hint` | postText, searchResults[] | string (1 line) | GPT-4o-mini chat | Template fallback on failure |

## End-to-End Flow (LLM Orchestration)

```
User clicks marker → PostPopup opens
  → GET /api/posts/{id}/suggestions
  → connectInProcess() → InMemoryTransport linked pair
  → listTools() → [search_m365, search_posts, generate_action_hint]
  → Convert to OpenAI function-calling format
  → GPT-4o-mini: "Post says X. Which tools should I call?"
  → LLM returns tool_calls: [search_m365(query), search_posts(query)]
  → callTool() for each → McpServer in-process execution:
      ├─ search_m365: Graph Search API → OneDrive/SharePoint/Email → top 0~10
      └─ search_posts: direct access via getAllEmbeddings() → cosine → top 0~5
  → Tool results → LLM
  → LLM may call generate_action_hint(postText, results)
  → LLM returns structured JSON: {m365, posts, actionHint}
  → Parse into CombinedSuggestionsResponse
  → SuggestionsPanel renders categorized results
```

## Fallback Strategy

| Scenario | Fallback |
|------|----------|
| LLM orchestration failure | Hardcoded parallel calls (existing pattern) |
| AI Foundry embedding failure | `search_posts` returns empty array |
| AI Foundry chat failure | Template-based hint generation |
| PostEmbedding cache empty | `search_posts` returns empty array |
| Total MCP connection failure | Display "No suggestions available" |
| Partial source failure | Display only successful sources, show "unavailable" for failed sources |
