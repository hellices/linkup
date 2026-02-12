// T032: MCP client wrapper — connects to MCP server, calls tools, combines results
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CombinedSuggestionsResponse, McpSuggestion, PostSummary } from "@/app/types";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? "http://localhost:3001/mcp";

async function createMcpClient(): Promise<Client> {
  const client = new Client({
    name: "linkup-app",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));
  await client.connect(transport);
  return client;
}

/**
 * Call MCP server to get combined suggestions for a post.
 * Handles partial failures per FR-018.
 */
export async function getCombinedSuggestions(
  postText: string,
  postId: string
): Promise<CombinedSuggestionsResponse> {
  const result: CombinedSuggestionsResponse = {
    docs: [],
    issues: [],
    posts: [],
    actionHint: null,
    source: "mcp",
    unavailableSources: [],
  };

  let client: Client | null = null;
  try {
    client = await createMcpClient();

    // Call search tools in parallel, handling individual failures
    const [docsResult, issuesResult, postsResult] = await Promise.allSettled([
      client.callTool({ name: "search_docs", arguments: { query: postText } }),
      client.callTool({ name: "search_issues", arguments: { query: postText } }),
      client.callTool({ name: "search_posts", arguments: { query: postText, excludePostId: postId } }),
    ]);

    // Process docs
    if (docsResult.status === "fulfilled" && docsResult.value.content) {
      try {
        const content = docsResult.value.content as Array<{ type: string; text?: string }>;
        const textContent = content.find((c) => c.type === "text");
        if (textContent?.text) {
          result.docs = JSON.parse(textContent.text) as McpSuggestion[];
        }
      } catch { /* parse error */ }
    } else {
      result.unavailableSources.push("docs");
    }

    // Process issues
    if (issuesResult.status === "fulfilled" && issuesResult.value.content) {
      try {
        const content = issuesResult.value.content as Array<{ type: string; text?: string }>;
        const textContent = content.find((c) => c.type === "text");
        if (textContent?.text) {
          result.issues = JSON.parse(textContent.text) as McpSuggestion[];
        }
      } catch { /* parse error */ }
    } else {
      result.unavailableSources.push("issues");
    }

    // Process posts
    if (postsResult.status === "fulfilled" && postsResult.value.content) {
      try {
        const content = postsResult.value.content as Array<{ type: string; text?: string }>;
        const textContent = content.find((c) => c.type === "text");
        if (textContent?.text) {
          result.posts = JSON.parse(textContent.text) as PostSummary[];
        }
      } catch { /* parse error */ }
    } else {
      result.unavailableSources.push("posts");
    }

    // Call action hint
    try {
      const allResults = [
        ...result.docs.map((d) => ({ title: d.title, description: d.description, sourceType: d.sourceType })),
        ...result.issues.map((d) => ({ title: d.title, description: d.description, sourceType: d.sourceType })),
      ];
      if (allResults.length > 0) {
        const hintResult = await client.callTool({
          name: "generate_action_hint",
          arguments: { postText, searchResults: allResults },
        });
        if (hintResult.content) {
          const content = hintResult.content as Array<{ type: string; text?: string }>;
          const textContent = content.find((c) => c.type === "text");
          if (textContent?.text) {
            result.actionHint = textContent.text;
          }
        }
      }
    } catch {
      // Action hint failure is graceful — FR-016 edge case
    }

    await client.close();
  } catch {
    // Full MCP failure — return empty result with all unavailable
    if (client) {
      try { await client.close(); } catch { /* ignore */ }
    }
    if (result.docs.length === 0 && result.unavailableSources.indexOf("docs") === -1) {
      result.unavailableSources.push("docs");
    }
    if (result.issues.length === 0 && result.unavailableSources.indexOf("issues") === -1) {
      result.unavailableSources.push("issues");
    }
  }

  return result;
}
