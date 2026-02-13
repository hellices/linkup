// Agent-specific types for the suggestions domain
// Shared across graph.ts, tools.ts, and fallback.ts
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { BaseMessage } from "@langchain/core/messages";

/**
 * Runtime context passed to the graph via `graph.invoke(input, { context })`.
 * Not part of agent state — not serializable, not checkpointed.
 */
export type SuggestionsContext = {
  mcpClient: Client;
  postId: string;
};

/**
 * Inferred agent state shape used by node functions.
 * Mirrors the StateSchema definition in graph.ts.
 */
export interface SuggestionsState {
  messages: BaseMessage[];
  llmCallCount: number;
}
