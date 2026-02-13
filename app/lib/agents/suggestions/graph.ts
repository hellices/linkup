// Suggestions agent — LangGraph StateGraph for MCP tool orchestration
// Graph: START → llmCall → [shouldContinue] → toolExec ↔ llmCall → formatResponse → END
import { StateGraph, StateSchema, MessagesValue, ReducedValue, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AzureChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectInProcess } from "@/app/lib/mcp/server";
import { createMcpTools } from "./tools";
import { fallbackDirectCalls } from "./fallback";
import { SUGGESTIONS_SYSTEM_PROMPT } from "./prompt";
import type { SuggestionsContext, SuggestionsState } from "./types";
import type { CombinedSuggestionsResponse, McpSuggestion } from "@/app/types";

// === Constants ===

const MAX_TOOL_ROUNDS = 5;
const AGENT_TIMEOUT_MS = 30_000;
const RECURSION_LIMIT = 12;

// === Model Factory ===

function createModel(): AzureChatOpenAI | null {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!apiKey || !endpoint) {
    console.log("[Suggestions] AzureChatOpenAI unavailable — missing env vars");
    return null;
  }

  const resourceName = new URL(endpoint).hostname.split(".")[0];
  const deploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? "gpt-4o-mini";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";

  return new AzureChatOpenAI({
    azureOpenAIApiKey: apiKey,
    azureOpenAIApiInstanceName: resourceName,
    azureOpenAIApiDeploymentName: deploymentName,
    azureOpenAIApiVersion: apiVersion,
    temperature: 0,
    timeout: 15_000,
  });
}

// === State Schema ===

const AgentState = new StateSchema({
  messages: MessagesValue,
  llmCallCount: new ReducedValue(
    z.number().default(0),
    { reducer: (x: number, y: number) => x + y }
  ),
});

const contextSchema = z.object({
  mcpClient: z.any(),
  postId: z.string(),
});

// === Node: llmCall ===

function createLlmCallNode(model: AzureChatOpenAI, tools: ReturnType<typeof createMcpTools>) {
  const modelWithTools = model.bindTools(tools);

  return async (state: SuggestionsState): Promise<Partial<SuggestionsState>> => {
    const start = performance.now();
    const response = await modelWithTools.invoke(state.messages);
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);

    const aiMsg = response as AIMessage;
    const toolCallNames = aiMsg.tool_calls?.map((tc) => tc.name) ?? [];
    console.log(
      `[Suggestions] Node: llmCall | Round: ${state.llmCallCount + 1}/${MAX_TOOL_ROUNDS} | Tools: [${toolCallNames.join(", ")}] | ${elapsed}s`
    );

    return { messages: [response], llmCallCount: 1 };
  };
}

// === Conditional Edge: shouldContinue ===

function shouldContinue(state: SuggestionsState): "toolExec" | "formatResponse" {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const hasToolCalls = lastMessage.tool_calls && lastMessage.tool_calls.length > 0;

  if (hasToolCalls && state.llmCallCount < MAX_TOOL_ROUNDS) {
    return "toolExec";
  }
  if (hasToolCalls && state.llmCallCount >= MAX_TOOL_ROUNDS) {
    console.log(`[Suggestions] Max tool rounds (${MAX_TOOL_ROUNDS}) reached — forcing final response`);
  }
  return "formatResponse";
}

// === Deduplication ===

function deduplicateResults(items: McpSuggestion[]): McpSuggestion[] {
  const seen = new Map<string, McpSuggestion>();
  for (const item of items) {
    const key = item.url || item.title;
    const existing = seen.get(key);
    if (!existing || (item.description?.length ?? 0) > (existing.description?.length ?? 0)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

// === Node: formatResponse ===

function formatResponseNode(state: SuggestionsState): Partial<SuggestionsState> {
  const parsed = parseAgentOutput(state.messages);
  if (parsed) {
    console.log(
      `[Suggestions] Node: formatResponse | m365: ${parsed.m365.length}, posts: ${parsed.posts.length}, hint: ${parsed.actionHint ? "yes" : "no"}`
    );
  } else {
    console.log("[Suggestions] Node: formatResponse | Failed to parse final output");
  }
  return {};
}

// === Output Parser ===

function parseAgentOutput(messages: BaseMessage[]): CombinedSuggestionsResponse | null {
  const lastAiMessage = [...messages].reverse().find((m) => m._getType() === "ai");
  if (!lastAiMessage) return null;

  const content = typeof lastAiMessage.content === "string" ? lastAiMessage.content : "";
  if (!content) return null;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      m365: deduplicateResults(Array.isArray(parsed.m365) ? parsed.m365 : []),
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      actionHint: typeof parsed.actionHint === "string" ? parsed.actionHint : null,
      source: "mcp",
      unavailableSources: [],
    };
  } catch {
    console.log("[Suggestions] Failed to parse agent output as JSON");
    return null;
  }
}

// === Graph Builder ===

function buildGraph(model: AzureChatOpenAI, tools: ReturnType<typeof createMcpTools>) {
  const toolNode = new ToolNode(tools);

  const graph = new StateGraph(AgentState, contextSchema)
    .addNode("llmCall", createLlmCallNode(model, tools))
    .addNode("toolExec", toolNode)
    .addNode("formatResponse", formatResponseNode)
    .addEdge(START, "llmCall")
    .addConditionalEdges("llmCall", shouldContinue, {
      toolExec: "toolExec",
      formatResponse: "formatResponse",
    })
    .addEdge("toolExec", "llmCall")
    .addEdge("formatResponse", END);

  return graph.compile();
}

// === Public API ===

/**
 * Get combined suggestions for a post via LangGraph agent orchestration.
 *
 * Primary path: LangGraph StateGraph agent with LLM-driven tool calling.
 * Fallback path: hardcoded parallel MCP tool calls (no LLM).
 * Timeout: configurable wall-clock timeout (default 30s).
 */
export async function getCombinedSuggestions(
  postText: string,
  postId: string,
  accessToken?: string
): Promise<CombinedSuggestionsResponse> {
  let client: Client | null = null;

  try {
    console.log("[Suggestions] Connecting to in-process MCP server...");
    client = await connectInProcess(accessToken);
    console.log("[Suggestions] Connected via InMemoryTransport");

    const model = createModel();
    if (!model) {
      console.log("[Suggestions] No LLM available — using fallback direct calls");
      const result = await fallbackDirectCalls(client, postText, postId);
      await client.close();
      return result;
    }

    const tools = createMcpTools();
    const compiledGraph = buildGraph(model, tools);

    const initialState = {
      messages: [
        new SystemMessage(SUGGESTIONS_SYSTEM_PROMPT),
        new HumanMessage(
          `Post text: "${postText}"\nPost ID (exclude from similar posts search): ${postId}\n\nFind relevant docs, issues, and similar posts, then suggest an action.`
        ),
      ],
    };

    const context: SuggestionsContext = { mcpClient: client, postId };

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), AGENT_TIMEOUT_MS);
    });

    console.log("[Suggestions] Invoking agent graph...");
    const graphStart = performance.now();

    const graphResult = await Promise.race([
      compiledGraph.invoke(initialState, { recursionLimit: RECURSION_LIMIT, context }),
      timeoutPromise,
    ]);

    const totalElapsed = ((performance.now() - graphStart) / 1000).toFixed(2);

    if (!graphResult) {
      console.log(`[Suggestions] Agent timed out after ${AGENT_TIMEOUT_MS}ms — falling back`);
      const result = await fallbackDirectCalls(client, postText, postId);
      await client.close();
      return result;
    }

    console.log(`[Suggestions] Agent completed in ${totalElapsed}s`);

    const parsed = parseAgentOutput(graphResult.messages as BaseMessage[]);
    await client.close();

    if (parsed) {
      console.log(
        `[Suggestions] ✅ m365: ${parsed.m365.length}, posts: ${parsed.posts.length}, hint: ${parsed.actionHint ? "yes" : "no"}`
      );
      return parsed;
    }

    console.log("[Suggestions] ⚠️ Output parse failed — falling back");
    client = await connectInProcess(accessToken);
    const fallbackResult = await fallbackDirectCalls(client, postText, postId);
    await client.close();
    return fallbackResult;
  } catch (err) {
    console.log("[Suggestions] ❌ Error:", (err as Error).message);

    if (client) {
      try {
        const fallbackResult = await fallbackDirectCalls(client, postText, postId);
        await client.close();
        return fallbackResult;
      } catch {
        try { await client.close(); } catch { /* ignore */ }
      }
    }

    return {
      m365: [],
      posts: [],
      actionHint: null,
      source: "mcp",
      unavailableSources: ["m365", "posts"],
    };
  }
}
