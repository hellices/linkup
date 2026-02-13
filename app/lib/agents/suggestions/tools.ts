// LangChain tool wrappers for MCP tools — delegates to Client.callTool() via runtime context
// Each wrapper matches the MCP tool's input schema and passes through to the MCP server
// MCP Client is accessed via config.context.mcpClient (LangGraph runtime context)
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { SuggestionsContext } from "./types";

/**
 * Extract text content from MCP tool call result.
 */
export function extractToolResultText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const textItem = (content as Array<{ type: string; text?: string }>).find(
    (c) => c.type === "text"
  );
  return textItem?.text ?? "";
}

/** Helper to get typed context from LangGraph config */
function getContext(config: RunnableConfig): SuggestionsContext {
  const ctx = (config as Record<string, unknown>).context as SuggestionsContext | undefined;
  if (!ctx?.mcpClient) {
    throw new Error("SuggestionsContext.mcpClient is required in runtime context");
  }
  return ctx;
}

// === Tool Wrappers ===

const searchM365Tool = tool(
  async (input: { query: string }, config: RunnableConfig): Promise<string> => {
    const { mcpClient } = getContext(config);
    try {
      const result = await mcpClient.callTool({
        name: "search_m365",
        arguments: { query: input.query },
      });
      return extractToolResultText(result.content);
    } catch (err) {
      console.log(`[Suggestions] Tool error: search_m365 — ${(err as Error).message}`);
      throw err;
    }
  },
  {
    name: "search_m365",
    description:
      "Search M365 internal resources (OneDrive files, SharePoint documents, Outlook emails) via Microsoft Graph Search API. PRIMARY source — returns results tagged with sub-source (onedrive/sharepoint/email) for UI grouping.",
    schema: z.object({
      query: z.string().describe("Search query text"),
    }),
  }
);

const searchPostsTool = tool(
  async (
    input: { query: string; excludePostId?: string },
    config: RunnableConfig
  ): Promise<string> => {
    const { mcpClient, postId } = getContext(config);
    try {
      const result = await mcpClient.callTool({
        name: "search_posts",
        arguments: {
          query: input.query,
          excludePostId: input.excludePostId ?? postId,
        },
      });
      return extractToolResultText(result.content);
    } catch (err) {
      console.log(`[Suggestions] Tool error: search_posts — ${(err as Error).message}`);
      throw err;
    }
  },
  {
    name: "search_posts",
    description:
      "Search existing LinkUp posts for similar questions using direct in-memory access",
    schema: z.object({
      query: z.string().describe("Search query text"),
      excludePostId: z
        .string()
        .optional()
        .describe("Post ID to exclude from results"),
    }),
  }
);

const generateActionHintTool = tool(
  async (
    input: {
      postText: string;
      searchResults: Array<{
        title: string;
        description: string;
        sourceType: string;
      }>;
    },
    config: RunnableConfig
  ): Promise<string> => {
    const { mcpClient } = getContext(config);
    try {
      const result = await mcpClient.callTool({
        name: "generate_action_hint",
        arguments: {
          postText: input.postText,
          searchResults: input.searchResults,
        },
      });
      return extractToolResultText(result.content);
    } catch (err) {
      console.log(`[Suggestions] Tool error: generate_action_hint — ${(err as Error).message}`);
      throw err;
    }
  },
  {
    name: "generate_action_hint",
    description:
      "Generate a 1-line action hint based on search results using GPT-4o-mini",
    schema: z.object({
      postText: z.string().describe("Original post text"),
      searchResults: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            sourceType: z.string(),
          })
        )
        .describe("Search results to base the hint on"),
    }),
  }
);

/**
 * Create all 3 LangChain tool wrappers for MCP tools.
 * Tools access the MCP Client via LangGraph runtime context (config.context.mcpClient).
 */
export function createMcpTools() {
  return [
    searchM365Tool,
    searchPostsTool,
    generateActionHintTool,
  ];
}
