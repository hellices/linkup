# API Contract: LangGraph Agent Migration

**Feature**: 002-langgraph-migration  
**Date**: 2025-02-12

## External API Contract (BREAKING CHANGE)

The external API contract for `GET /api/posts/{postId}/suggestions` has been modified. The `docs` and `issues` fields have been removed from the `CombinedSuggestionsResponse` type, as the migration focuses only on M365 resources and similar posts.

Refer to the existing OpenAPI spec at `specs/001-map-first-mvp/contracts/openapi.yaml` for the baseline endpoint definition.

### Response Schema (modified)

```yaml
CombinedSuggestionsResponse:
  type: object
  required: [m365, posts, actionHint, source, unavailableSources]
  properties:
    m365:
      type: array
      items:
        $ref: '#/components/schemas/McpSuggestion'
      description: "PRIMARY — M365 internal resources"
    posts:
      type: array
      items:
        $ref: '#/components/schemas/PostSummary'
      description: "Related posts from LinkUp"
    actionHint:
      type: string
      nullable: true
      description: "1-line action suggestion"
    source:
      type: string
      enum: [mcp]
      description: "Always 'mcp'"
    unavailableSources:
      type: array
      items:
        type: string
      description: "Sources that failed during retrieval"
```

**Note**: The `docs` and `issues` fields present in the previous version have been removed.

## Internal Contract: Graph Module Interface

The `app/lib/agents/suggestions/` module exports the main function from `graph.ts` via the barrel export in `index.ts`:

```typescript
/**
 * Get combined suggestions for a post via LangGraph agent orchestration.
 *
 * Primary path: LangGraph StateGraph agent with LLM-driven tool calling.
 * Fallback path: hardcoded parallel MCP tool calls (no LLM).
 * Timeout: configurable wall-clock timeout (default 30s).
 *
 * @param postText - The post's text content
 * @param postId - The post's ID (excluded from similar posts search)
 * @param accessToken - Optional Microsoft Graph access token for M365 search
 * @returns CombinedSuggestionsResponse
 */
export async function getCombinedSuggestions(
  postText: string,
  postId: string,
  accessToken?: string
): Promise<CombinedSuggestionsResponse>;
```

### Import Pattern

The API route imports directly from the agent module:

```typescript
// app/api/posts/[postId]/suggestions/route.ts
import { getCombinedSuggestions } from "@/app/lib/agents/suggestions";
```

Note: The previous `mcp-client.ts` has been removed as part of this migration.

## Internal Contract: Tool Wrappers

`tools.ts` exports a function to create LangChain tool instances:

```typescript
import { StructuredTool } from "@langchain/core/tools";

/**
 * Create LangChain tool wrappers for all MCP tools.
 * Each tool delegates to client.callTool() internally via runtime context.
 *
 * @returns Array of LangChain StructuredTool instances
 */
export function createMcpTools(): StructuredTool[];
```

## Configuration Constants

| Constant | Default | Description |
|----------|---------|-------------|
| `MAX_TOOL_ROUNDS` | `5` | Maximum LLM↔tool round-trips before forcing final answer |
| `AGENT_TIMEOUT_MS` | `30000` | Wall-clock timeout for the entire graph execution |
| `RECURSION_LIMIT` | `12` | LangGraph recursion limit (accommodates MAX_TOOL_ROUNDS × 2 super-steps + overhead) |
