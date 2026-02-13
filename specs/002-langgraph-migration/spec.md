# Feature Specification: LangGraph Agent Migration

**Feature Branch**: `002-langgraph-migration`  
**Created**: 2025-02-12  
**Status**: Draft  
**Input**: User description: "Migrate the manual LLM orchestration loop in mcp-client.ts to a LangGraph StateGraph-based agent"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - LLM-Driven Suggestion Retrieval Works Identically (Priority: P1)

When a user posts a question on LinkUp, the system searches M365 internal resources and similar posts via a LangGraph agent, generates an action hint, and displays results in the SuggestionsPanel. The output must be identical to the existing manual tool-use loop.

**Why this priority**: The migration is only valid if core functionality behaves identically. If the response shape (CombinedSuggestionsResponse) changes, the UI and API contract break.

**Independent Test**: Create a post and verify the Suggestions panel loads with M365 results, similar posts, and action hint displayed correctly.

**Acceptance Scenarios**:

1. **Given** a user has created a post and AI Foundry env vars are configured, **When** the suggestions API is called, **Then** the LangGraph agent invokes MCP tools and returns results in the CombinedSuggestionsResponse format.
2. **Given** the agent has called search_m365 with multiple queries and duplicate results exist, **When** the agent produces the final response, **Then** duplicates are removed (by matching URL or title).
3. **Given** all search tools return empty results, **When** the agent produces the final response, **Then** empty arrays and a null actionHint are returned without errors.

---

### User Story 2 - Multi-Query Expansion via Graph Nodes (Priority: P1)

The LangGraph agent analyzes the user's question to generate 2–3 diverse search queries and calls search_m365 in parallel for each query. This compensates for the keyword-based limitations of the Graph Search API.

**Why this priority**: Query expansion is critical for search quality and was already emphasized in the existing system prompt strategy. Expressing it as an explicit graph node makes it easier to debug and extend.

**Independent Test**: Submit a question (e.g., "How to set up a deployment pipeline") and verify via logs that the agent calls search_m365 at least 2 times with expanded queries such as "CI/CD" and "deployment pipeline."

**Acceptance Scenarios**:

1. **Given** a user has posted a question on a specific topic, **When** the LangGraph agent runs, **Then** 2–3 queries are generated including synonyms and related technical terms beyond the original keywords.
2. **Given** an expanded query list exists, **When** the search node executes, **Then** search_m365 is called for each query and results are merged with duplicates removed.

---

### User Story 3 - Graceful Fallback When AI Foundry Unavailable (Priority: P1)

When AI Foundry env vars are missing or the LLM call fails, the system automatically switches to the existing fallback pattern (hardcoded parallel calls) and returns results.

**Why this priority**: Core search functionality must remain available even when the external LLM service is down. Without a fallback, this becomes a single point of failure.

**Independent Test**: Remove AI Foundry env vars, call the suggestions API, and verify that all 4 search tools are called in parallel directly and results are returned.

**Acceptance Scenarios**:

1. **Given** AI Foundry env vars are not configured, **When** the suggestions API is called, **Then** the fallback path executes, calling all MCP tools in parallel and returning results.
2. **Given** an LLM call throws an exception during LangGraph agent execution, **When** the exception is caught, **Then** the system automatically switches to the fallback path without exposing errors to the user.
3. **Given** the MCP server connection itself fails, **When** getCombinedSuggestions is called, **Then** an empty response with all sources marked as unavailable is returned.

---

### User Story 4 - Observable Graph Execution for Debugging (Priority: P2)

Developers can observe agent execution via LangGraph's structured logging — which nodes were traversed, input/output for each tool call, and total elapsed time.

**Why this priority**: One of the key problems with the existing implementation was difficulty debugging. Graph-based execution enables tracking each node/edge, making diagnostics significantly easier.

**Independent Test**: In development mode, send a suggestions request and verify that console logs show node execution order, tool call arguments/results, and per-step elapsed time.

**Acceptance Scenarios**:

1. **Given** the LangGraph agent is executing, **When** each node is processed, **Then** the node name, input state, output state, and elapsed time are recorded in logs.
2. **Given** a tool call fails, **When** the error occurs, **Then** the failed tool name, arguments, and error message are logged and the agent continues to the next step.

---

### User Story 5 - Timeout Enforcement on Agent Execution (Priority: P2)

A timeout is applied to the overall agent execution to prevent delays from infinite loops or excessive LLM calls.

**Why this priority**: The existing implementation only capped the number of rounds (MAX_TOOL_ROUNDS=5), but actual wall-clock time could reach up to 75 seconds. A total elapsed time limit is needed for user experience.

**Independent Test**: Simulate intentionally slow tool responses and verify that after the configured timeout, partial results or a fallback response is returned.

**Acceptance Scenarios**:

1. **Given** agent execution exceeds the configured timeout, **When** the timeout fires, **Then** partial results collected up to that point are returned, or the fallback path is executed.
2. **Given** a normal request, **When** the agent runs, **Then** total elapsed time completes within the timeout.

---

### Edge Cases

- How is it handled when the agent tries to call the same tool repeatedly (infinite loop prevention)?
- When some MCP tools fail while others succeed, are partial results merged correctly?
- When the Graph Search API hits a rate limit, does the agent handle the error gracefully and continue?
- When accessToken is missing and search_m365 returns empty results, does the agent focus on other sources?
- When the LLM returns malformed JSON, how is the parsing failure recovered?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define the suggestion-generation agent using `StateGraph` from `@langchain/langgraph`. The graph is composed of explicit nodes (query expansion, search, deduplication, response formatting) and edges (including conditional routing).
- **FR-002**: Agent state MUST include message history, search results, expanded query list, and execution metadata, leveraging LangGraph's `StateSchema` and `MessagesValue`.
- **FR-003**: The system MUST wrap the existing 3 MCP tools (search_m365, search_posts, generate_action_hint) as LangChain tools and bind them to the agent. Existing MCP tool logic MUST NOT be modified.
- **FR-004**: The agent MUST generate 2–3 diverse search queries in the query expansion node by analyzing the user's question. Queries include original keywords, synonyms/related terms, and broader conceptual terms.
- **FR-005**: The agent MUST call all MCP search tools in the search node. search_m365 is called separately for each expanded query; other tools are called with the original or an appropriate query.
- **FR-006**: The agent MUST merge multiple search results and remove duplicates in the deduplication node (by matching URL or title). The version with the better description is kept.
- **FR-007**: The agent's final output MUST be compatible with `CombinedSuggestionsResponse` type. Note: This migration removes the `docs` and `issues` fields from the response (breaking change - only m365, posts, actionHint, source, unavailableSources remain).
- **FR-008**: When AI Foundry is unavailable, the system MUST automatically switch to the existing fallback pattern (hardcoded parallel MCP tool calls).
- **FR-009**: A configurable timeout MUST be applied to the overall agent execution. On timeout, partial results are returned or the fallback path is triggered.
- **FR-010**: Each node execution MUST emit structured logs (node name, elapsed time, tool call arguments/result summary).
- **FR-011**: The LangGraph agent MUST maintain the in-process MCP server connection (InMemoryTransport) and MUST NOT modify existing MCP server code (server.ts, tools/*.ts).
- **FR-012**: The agent's tool-use round count MUST have a maximum limit (corresponding to the existing MAX_TOOL_ROUNDS=5), implemented via LangGraph's conditional edge logic.

### Key Entities

- **AgentState**: The agent's execution state defined via LangGraph `StateSchema`. Includes messages (conversation history), searchResults (per-tool collected results), expandedQueries (expanded query list), and toolCallCount (round counter).
- **GraphNode**: A LangGraph node representing each processing step — query expansion, LLM call, tool execution, deduplication, response formatting, etc.
- **MCP Tool Wrapper**: An adapter that wraps existing MCP tools in LangChain `tool()` format. Encapsulates callTool() invocations through the MCP client.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After migration, all existing acceptance scenarios pass — the suggestions API returns an identical CombinedSuggestionsResponse structure.
- **SC-002**: Agent execution completes within the configured timeout, allowing users to see suggestions within a reasonable time frame.
- **SC-003**: The agent's query expansion improves search recall compared to a single query — more relevant documents are discovered through diverse keywords.
- **SC-004**: Developers can trace which nodes were traversed, which tools were called, and what was returned at each step solely from agent execution logs.
- **SC-005**: On AI Foundry failure, the system automatically switches to the fallback path and serves results to users without errors. The switch happens immediately upon detection (no additional retries).
- **SC-006**: Code structure is improved so that adding new search sources or processing steps requires only adding nodes/edges to the graph without modifying existing nodes.

## Assumptions

- `@langchain/langgraph` and `@langchain/core` are added as new project dependencies.
- Azure OpenAI integration uses `AzureChatOpenAI` from `@langchain/openai` (replacing the direct OpenAI SDK usage).
- Existing MCP server and tool code (server.ts, tools/*.ts) are not modified. MCP tool wrappers invoke tools through the existing MCP client.
- The InMemoryTransport-based in-process architecture is preserved.
- The SuggestionsPanel UI component is not modified (since the API response format remains identical).
- Existing fallback pattern logic is preserved but managed as a separate function from the LangGraph code.
- Integration with external observability tools (e.g., LangSmith) is out of scope for this spec; logging is limited to console-based output.
