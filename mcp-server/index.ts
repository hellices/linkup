// T025: MCP server entry point with Streamable HTTP transport
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { z } from "zod";
import { searchDocs } from "./tools/search-docs.js";
import { searchIssues } from "./tools/search-issues.js";
import { searchPosts } from "./tools/search-posts.js";
import { generateActionHint } from "./tools/action-hint.js";

const PORT = parseInt(process.env.MCP_PORT ?? "3001", 10);

const server = new McpServer({
  name: "linkup-mcp",
  version: "1.0.0",
});

// Register tools
server.tool(
  "search_docs",
  "Search Azure documentation for relevant resources",
  { query: z.string().describe("Search query text") },
  async ({ query }) => {
    const results = searchDocs(null); // MVP: no real embeddings in MCP server, return all
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results) }],
    };
  }
);

server.tool(
  "search_issues",
  "Search GitHub issues for relevant problems and solutions",
  { query: z.string().describe("Search query text") },
  async ({ query }) => {
    const results = searchIssues(null);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results) }],
    };
  }
);

server.tool(
  "search_posts",
  "Search existing LinkUp posts for similar questions",
  {
    query: z.string().describe("Search query text"),
    excludePostId: z.string().optional().describe("Post ID to exclude from results"),
  },
  async ({ query, excludePostId }) => {
    const results = searchPosts(null, excludePostId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results) }],
    };
  }
);

server.tool(
  "generate_action_hint",
  "Generate a 1-line action hint based on search results",
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
    const hint = generateActionHint(postText, searchResults);
    return {
      content: [{ type: "text" as const, text: hint ?? "" }],
    };
  }
);

// Start HTTP server with Streamable HTTP transport
const httpServer = createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/mcp") {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless for MVP
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  } else if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", tools: ["search_docs", "search_issues", "search_posts", "generate_action_hint"] }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`[MCP Server] Running on http://localhost:${PORT}/mcp`);
  console.log(`[MCP Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[MCP Server] Tools: search_docs, search_issues, search_posts, generate_action_hint`);
});
