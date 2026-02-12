// T025: In-process McpServer factory — creates McpServer + InMemoryTransport pair per request
// Uses a factory pattern to avoid "Already connected to a transport" errors.
// Each call to connectInProcess() returns a fresh linked MCP client+server pair.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { searchDocs } from "./tools/search-docs";
import { searchIssues } from "./tools/search-issues";
import { searchPosts } from "./tools/search-posts";
import { searchM365 } from "./tools/search-m365";
import { generateActionHint } from "./tools/action-hint";

/**
 * Create a new McpServer with all 4 tools registered.
 * Fresh instance per request to avoid transport conflicts.
 * @param accessToken Optional Microsoft Graph access token for M365 search.
 */
function createServer(accessToken?: string): McpServer {
  const server = new McpServer({
    name: "linkup-mcp",
    version: "1.0.0",
  });

  // === PRIMARY: M365 internal resources unified search ===

  server.tool(
    "search_m365",
    "Search M365 internal resources (OneDrive files, SharePoint documents, Outlook emails) via Microsoft Graph Search API. PRIMARY source — returns results tagged with sub-source (onedrive/sharepoint/email) for UI grouping.",
    { query: z.string().describe("Search query text") },
    async ({ query }) => {
      const results = await searchM365(query, accessToken);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }],
      };
    }
  );

  // === SUPPLEMENTARY: Web resources search ===

  server.tool(
    "search_docs",
    "Search Azure documentation for relevant resources. SUPPLEMENTARY — use in addition to M365 internal search.",
    { query: z.string().describe("Search query text") },
    async ({ query }) => {
      const results = await searchDocs(query);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }],
      };
    }
  );

  server.tool(
    "search_issues",
    "Search GitHub issues for relevant problems and solutions. SUPPLEMENTARY — use in addition to M365 internal search.",
    { query: z.string().describe("Search query text") },
    async ({ query }) => {
      const results = await searchIssues(query);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }],
      };
    }
  );

  server.tool(
    "search_posts",
    "Search existing LinkUp posts for similar questions using direct in-memory access",
    {
      query: z.string().describe("Search query text"),
      excludePostId: z.string().optional().describe("Post ID to exclude from results"),
    },
    async ({ query, excludePostId }) => {
      const results = await searchPosts(query, excludePostId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }],
      };
    }
  );

  server.tool(
    "generate_action_hint",
    "Generate a 1-line action hint based on search results using GPT-4o-mini",
    {
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
    },
    async ({ postText, searchResults }) => {
      const hint = await generateActionHint(postText, searchResults);
      return {
        content: [{ type: "text" as const, text: hint ?? "" }],
      };
    }
  );

  return server;
}

/**
 * Create an in-process MCP client connected to a fresh server via InMemoryTransport.
 * Returns the Client — caller must call client.close() when done.
 * @param accessToken Optional Microsoft Graph access token for M365 search.
 */
export async function connectInProcess(accessToken?: string): Promise<Client> {
  const server = createServer(accessToken);
  const client = new Client({ name: "linkup-app", version: "1.0.0" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}
