# API Contract: LangGraph Agent Migration

**Feature**: 002-langgraph-migration  
**Date**: 2025-02-12

## External API Contract (UNCHANGED)

The external API contract for `GET /api/posts/{postId}/suggestions` remains **completely unchanged**. The response schema is identical to the existing `CombinedSuggestionsResponse` type.

Refer to the existing OpenAPI spec at `specs/001-map-first-mvp/contracts/openapi.yaml` for the full endpoint definition.

### Response Schema (unchanged)

```yaml
CombinedSuggestionsResponse:
  type: object
  required: [m365, docs, issues, posts, actionHint, source, unavailableSources]
  properties:
    m365:
      type: array
      items:
        $ref: '#/components/schemas/McpSuggestion'
      description: "PRIMARY — M365 internal resources"
    docs:
      type: array
      items:
        $ref: '#/components/schemas/McpSuggestion'
      description: "SUPPLEMENTARY — documentation results"
    issues:
      type: array
      items:
        $ref: '#/components/schemas/McpSuggestion'
      description: "SUPPLEMENTARY — GitHub issues"
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

## Internal Contract: Graph Module Interface

The new `mcp-agent.ts` module exports the same function signature as the current `mcp-client.ts`:

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

### Backward Compatibility Shim

`mcp-client.ts` will be modified to re-export from `mcp-agent.ts`:

```typescript
// mcp-client.ts — backward compatibility shim
export { getCombinedSuggestions } from "./mcp-agent";
```

This ensures all existing imports (`import { getCombinedSuggestions } from "@/app/lib/mcp-client"`) continue to work without modification.

## Internal Contract: Tool Wrappers

`mcp-tools.ts` exports a function to create LangChain tool instances bound to an MCP client:

```typescript
import { StructuredTool } from "@langchain/core/tools";

/**
 * Create LangChain tool wrappers for all MCP tools.
 * Each tool delegates to client.callTool() internally.
 *
 * @param client - Connected MCP Client instance
 * @param postId - Post ID to exclude from search_posts results
 * @returns Array of LangChain StructuredTool instances
 */
export function createMcpTools(
  client: Client,
  postId: string
): StructuredTool[];
```

## Configuration Constants

| Constant | Default | Description |
|----------|---------|-------------|
| `MAX_TOOL_ROUNDS` | `5` | Maximum LLM↔tool round-trips before forcing final answer |
| `AGENT_TIMEOUT_MS` | `30000` | Wall-clock timeout for the entire graph execution |
| `RECURSION_LIMIT` | `12` | LangGraph recursion limit (accommodates MAX_TOOL_ROUNDS × 2 super-steps + overhead) |
