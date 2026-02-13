// Fallback: hardcoded parallel MCP tool calls when AI Foundry is unavailable
// Direct calls without LLM orchestration — preserves existing reliability pattern
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CombinedSuggestionsResponse, McpSuggestion, PostSummary } from "@/app/types";
import { extractToolResultText } from "./tools";

/**
 * Fallback: hardcoded parallel tool calls when AI Foundry is unavailable.
 * Direct calls without LLM orchestration.
 */
export async function fallbackDirectCalls(
  client: Client,
  postText: string,
  postId: string
): Promise<CombinedSuggestionsResponse> {
  console.log("[Suggestions] Executing fallback: parallel direct MCP calls (no LLM)");
  const result: CombinedSuggestionsResponse = {
    m365: [],
    posts: [],
    actionHint: null,
    source: "mcp",
    unavailableSources: [],
  };

  const [m365Result, postsResult] = await Promise.allSettled([
    client.callTool({ name: "search_m365", arguments: { query: postText } }),
    client.callTool({
      name: "search_posts",
      arguments: { query: postText, excludePostId: postId },
    }),
  ]);

  if (m365Result.status === "fulfilled") {
    try {
      const text = extractToolResultText(m365Result.value.content);
      if (text) result.m365 = JSON.parse(text) as McpSuggestion[];
    } catch { /* parse error */ }
  } else {
    result.unavailableSources.push("m365");
  }

  if (postsResult.status === "fulfilled") {
    try {
      const text = extractToolResultText(postsResult.value.content);
      if (text) result.posts = JSON.parse(text) as PostSummary[];
    } catch { /* parse error */ }
  } else {
    result.unavailableSources.push("posts");
  }

  // Action hint via direct call
  try {
    const allResults = [
      ...result.m365.map((d) => ({ title: d.title, description: d.description, sourceType: d.sourceType })),
    ];
    if (allResults.length > 0) {
      const hintResult = await client.callTool({
        name: "generate_action_hint",
        arguments: { postText, searchResults: allResults },
      });
      const hintText = extractToolResultText(hintResult.content);
      if (hintText) result.actionHint = hintText;
    }
  } catch {
    // Action hint failure is graceful
  }

  return result;
}
