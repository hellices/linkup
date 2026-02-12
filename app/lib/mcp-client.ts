// T032: MCP client wrapper — LLM-driven tool orchestration (FR-023)
// Flow: connect in-process MCP → listTools() → LLM decides which tools → callTool() → LLM combines → structured response
// Fallback: if AI Foundry unavailable, hardcoded parallel calls (existing pattern)
// Architecture: single-process via InMemoryTransport (no sidecar, no HTTP)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectInProcess } from "@/app/lib/mcp/server";
import { getOrchestrationClient, getChatDeploymentName } from "@/app/lib/ai-foundry";
import type { CombinedSuggestionsResponse, McpSuggestion, PostSummary } from "@/app/types";
import type OpenAI from "openai";

const MAX_TOOL_ROUNDS = 5; // allow query-expansion + search + action-hint rounds

/**
 * Convert MCP tool schemas (from listTools) to OpenAI function-calling format.
 */
function mcpToolsToOpenAIFunctions(
  mcpTools: Array<{ name: string; description?: string; inputSchema: { type: "object"; properties?: Record<string, object>; required?: string[] } }>
): OpenAI.ChatCompletionTool[] {
  return mcpTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: {
        type: "object" as const,
        properties: tool.inputSchema.properties ?? {},
        required: tool.inputSchema.required ?? [],
      },
    },
  }));
}

/**
 * Extract text content from MCP tool call result.
 */
function extractToolResultText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const textItem = (content as Array<{ type: string; text?: string }>).find(
    (c) => c.type === "text"
  );
  return textItem?.text ?? "";
}

const ORCHESTRATION_SYSTEM_PROMPT = `You are a helpful assistant for LinkUp, a location-based Q&A platform.
Given a user's post, use the available MCP tools to find relevant resources and generate suggestions.

Strategy:
1. **Query Expansion** — Before searching, analyze the post text and generate 2-3 diverse search queries:
   - The original keywords from the post
   - Synonyms, related technical terms, or alternative phrasings (e.g., "배포 파이프라인" → also search "CI/CD", "deployment pipeline")
   - Broader conceptual terms that related documents might use
   This is critical because the Graph Search API uses keyword-based matching, so documents titled differently from the question will be missed with a single query.

2. **Search M365 with multiple queries** — Call search_m365 MULTIPLE TIMES with each expanded query. This searches OneDrive files, SharePoint documents, and Outlook emails. These are the PRIMARY sources.

3. **Search supplementary sources** — Search docs, issues, and similar posts (can use the original post text or expanded queries as appropriate).

4. **Deduplicate** — When combining results from multiple search calls, remove duplicates (same URL or title). Keep the version with the better description.

5. **Generate action hint** — Based on all search results, generate an action hint suggesting the next step.

6. **Return final JSON response.**

IMPORTANT: You MUST return the final answer as a JSON object with this exact schema:
{
  "m365": [{"title": string, "url": string, "description": string, "source": "onedrive"|"sharepoint"|"email", "sourceType": "m365", "status": "available"}],
  "docs": [{"title": string, "url": string, "description": string, "sourceType": "doc", "status": "available"}],
  "issues": [{"title": string, "url": string, "description": string, "sourceType": "issue", "status": "available"}],
  "posts": [{"id": string, "text": string, ...PostSummary fields}],
  "actionHint": string | null
}

Only include results that are genuinely relevant. If a search returns no useful results, use an empty array.`;

/**
 * LLM-driven MCP tool orchestration.
 * The LLM decides which tools to call, in what order, with what arguments.
 */
async function orchestrateWithLLM(
  client: Client,
  postText: string,
  postId: string
): Promise<CombinedSuggestionsResponse | null> {
  const orchestrator = getOrchestrationClient();
  if (!orchestrator) {
    console.log("[MCP Client] getOrchestrationClient() returned null — AI Foundry env vars missing?");
    return null;
  }

  // Step 1: Discover available tools from MCP server
  console.log("[MCP Client] Step 1: listTools()...");
  const toolsResult = await client.listTools();
  const mcpTools = toolsResult.tools;
  console.log(`[MCP Client] Discovered ${mcpTools.length} tools:`, mcpTools.map(t => t.name));
  if (mcpTools.length === 0) return null;

  // Step 2: Convert MCP tools to OpenAI function-calling format
  const openaiTools = mcpToolsToOpenAIFunctions(
    mcpTools as Array<{
      name: string;
      description?: string;
      inputSchema: { type: "object"; properties?: Record<string, object>; required?: string[] };
    }>
  );

  // Step 3: Start conversation with LLM
  const model = getChatDeploymentName();
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: ORCHESTRATION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Post text: "${postText}"\nPost ID (exclude from similar posts search): ${postId}\n\nFind relevant docs, issues, and similar posts, then suggest an action.`,
    },
  ];

  // Step 4: Tool-use loop — LLM calls tools, we execute, feed results back
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[MCP Client] Step 4: LLM round ${round + 1}/${MAX_TOOL_ROUNDS}...`);
    const completion = await orchestrator.chat.completions.create({
      model,
      messages,
      tools: openaiTools,
      tool_choice: "auto",
    });

    const choice = completion.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    // If no tool calls, LLM has given final answer
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      console.log("[MCP Client] LLM returned final answer (no more tool calls)");
      break;
    }

    console.log(`[MCP Client] LLM requested ${assistantMessage.tool_calls.length} tool call(s):`,
      assistantMessage.tool_calls.map(tc => tc.type === 'function' ? tc.function.name : tc.type));

    // Execute each tool call via MCP
    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== "function") continue; // skip custom tool calls

      let toolResultText: string;
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const mcpResult = await client.callTool({
          name: toolCall.function.name,
          arguments: args,
        });
        toolResultText = extractToolResultText(mcpResult.content);
      } catch (err) {
        toolResultText = JSON.stringify({ error: (err as Error).message });
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResultText,
      });
    }
  }

  // Step 5: Parse LLM's final structured response
  const lastMessage = messages[messages.length - 1];
  const finalContent =
    lastMessage.role === "assistant" && "content" in lastMessage
      ? (lastMessage.content as string)
      : null;

  if (!finalContent) return null;

  try {
    // Extract JSON from response (LLM may wrap in markdown code block)
    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      m365: Array.isArray(parsed.m365) ? parsed.m365 : [],
      docs: Array.isArray(parsed.docs) ? parsed.docs : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      actionHint: typeof parsed.actionHint === "string" ? parsed.actionHint : null,
      source: "mcp",
      unavailableSources: [],
    };
  } catch {
    return null;
  }
}

/**
 * Fallback: hardcoded parallel tool calls when AI Foundry is unavailable.
 * Direct calls without LLM orchestration (same as old implementation).
 */
async function fallbackDirectCalls(
  client: Client,
  postText: string,
  postId: string
): Promise<CombinedSuggestionsResponse> {
  const result: CombinedSuggestionsResponse = {
    m365: [],
    docs: [],
    issues: [],
    posts: [],
    actionHint: null,
    source: "mcp",
    unavailableSources: [],
  };

  // All sources in parallel: M365 (primary) + web (supplementary) + posts
  const [m365Result, docsResult, issuesResult, postsResult] = await Promise.allSettled([
    client.callTool({ name: "search_m365", arguments: { query: postText } }),
    client.callTool({ name: "search_docs", arguments: { query: postText } }),
    client.callTool({ name: "search_issues", arguments: { query: postText } }),
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

  if (docsResult.status === "fulfilled") {
    try {
      const text = extractToolResultText(docsResult.value.content);
      if (text) result.docs = JSON.parse(text) as McpSuggestion[];
    } catch { /* parse error */ }
  } else {
    result.unavailableSources.push("docs");
  }

  if (issuesResult.status === "fulfilled") {
    try {
      const text = extractToolResultText(issuesResult.value.content);
      if (text) result.issues = JSON.parse(text) as McpSuggestion[];
    } catch { /* parse error */ }
  } else {
    result.unavailableSources.push("issues");
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
      ...result.m365.map((d) => ({
        title: d.title,
        description: d.description,
        sourceType: d.sourceType,
      })),
      ...result.docs.map((d) => ({
        title: d.title,
        description: d.description,
        sourceType: d.sourceType,
      })),
      ...result.issues.map((d) => ({
        title: d.title,
        description: d.description,
        sourceType: d.sourceType,
      })),
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
    // Action hint failure is graceful — FR-016
  }

  return result;
}

/**
 * Get combined suggestions for a post via MCP with LLM-driven orchestration.
 *
 * Primary path (FR-023): LLM discovers tools → decides which to call → combines results.
 * Fallback path: hardcoded parallel calls when AI Foundry is unavailable.
 * Handles partial/full failures per FR-018.
 */
export async function getCombinedSuggestions(
  postText: string,
  postId: string,
  accessToken?: string
): Promise<CombinedSuggestionsResponse> {
  let client: Client | null = null;

  try {
    console.log("[MCP Client] Connecting to in-process MCP server...");
    client = await connectInProcess(accessToken);
    console.log("[MCP Client] Connected via InMemoryTransport. Attempting LLM-driven orchestration...");

    // Try LLM-driven orchestration first
    let llmResult: CombinedSuggestionsResponse | null = null;
    try {
      llmResult = await orchestrateWithLLM(client, postText, postId);
    } catch (orchErr) {
      console.log("[MCP Client] ⚠️ LLM orchestration error:", (orchErr as Error).message);
    }
    if (llmResult) {
      console.log("[MCP Client] ✅ LLM orchestration succeeded");
      await client.close();
      return llmResult;
    }

    // Fallback to direct calls
    console.log("[MCP Client] ⚠️ LLM orchestration returned null or failed, falling back to direct calls");
    const directResult = await fallbackDirectCalls(client, postText, postId);
    await client.close();
    return directResult;
  } catch (err) {
    console.log("[MCP Client] ❌ MCP connection failed:", (err as Error).message);
    if (client) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
    }
    return {
      m365: [],
      docs: [],
      issues: [],
      posts: [],
      actionHint: null,
      source: "mcp",
      unavailableSources: ["m365", "docs", "issues", "posts"],
    };
  }
}
