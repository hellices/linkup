# Quickstart: 002 — LangGraph Agent Migration

## Prerequisites

- Node.js ≥ 18
- Azure OpenAI deployment with GPT-4o and text-embedding-3-small
- Environment variables configured (see below)

## 1. Install Dependencies

```bash
npm install @langchain/langgraph@^1.1.4 @langchain/openai@^1.2.7 @langchain/core@^1.1.24
```

Add `overrides` to `package.json` to ensure a single `@langchain/core` instance:

```json
{
  "overrides": {
    "@langchain/core": "$@langchain/core"
  }
}
```

## 2. Environment Variables

All existing env vars remain unchanged. No new variables are required.

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | chat model deployment (e.g. `gpt-4o`) |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME` | embedding model deployment |
| `AZURE_OPENAI_API_VERSION` | API version (e.g. `2024-12-01-preview`) |

## 3. New File Layout

```
app/lib/
  agents/
    suggestions/         ← NEW: LangGraph agent module (modular pattern)
      types.ts           ← SuggestionsContext, SuggestionsState
      prompt.ts          ← SUGGESTIONS_SYSTEM_PROMPT constant
      tools.ts           ← 5 LangChain tool() wrappers for MCP tools
      fallback.ts        ← Hardcoded parallel MCP calls (no LLM fallback)
      graph.ts           ← StateGraph: nodes, edges, getCombinedSuggestions
      index.ts           ← Barrel re-exports
  mcp-client.ts          ← MODIFIED: re-export shim (backward compat)
  ai-foundry.ts          ← UNCHANGED
  mcp/                   ← UNCHANGED (MCP server + tools)
```

## 4. Verify

```bash
# Start the dev server
npm run dev

# In another terminal, create a post or use an existing one:
# Navigate to http://localhost:3000
# 1. Log in (Microsoft OAuth)
# 2. Create a new post
# 3. Open the post → check the Suggestions panel loads
# 4. Verify suggestions appear for M365, docs, issues, posts, action hint
```

### What to Check

- **Suggestions panel** renders the same categories as before
- **Console logs** show LangGraph agent execution (node transitions, tool calls)
- **Fallback** works when LLM is unavailable (disable Azure OpenAI temporarily)
- **Timeout** triggers after 30s if agent stalls (intentionally delay a tool to test)

## 5. Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| `GraphRecursionError` | Tool loop exceeds limit | Check `recursionLimit` (default 12) and `MAX_TOOL_ROUNDS` (5) |
| `AzureChatOpenAI` auth error | Missing env vars | Verify `AZURE_OPENAI_*` environment variables |
| Duplicate `@langchain/core` warning | Missing overrides | Add `overrides` section to package.json |
| Empty suggestions | Graph timeout | Check network, increase `AGENT_TIMEOUT_MS` if needed |
| Tool results missing | MCP client not connected | Verify `connectInProcess()` succeeds in logs |
