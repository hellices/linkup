// T023: AI Foundry client — embeddings (text-embedding-3-small) + chat (gpt-4o-mini) + fallback
import OpenAI from "openai";
import type { PostEmbedding } from "@/app/types";

// In-memory embedding cache (per data-model.md: runtime cache, not DB)
const embeddingCache: Map<string, PostEmbedding> = new Map();

// Lazy-init the OpenAI client for embeddings (API key auth required per R7)
let _embeddingClient: OpenAI | null = null;
function getEmbeddingClient(): OpenAI | null {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
    return null;
  }
  if (!_embeddingClient) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
    const resourceName = new URL(endpoint).hostname.split(".")[0];
    _embeddingClient = new OpenAI({
      baseURL: `https://${resourceName}.openai.azure.com/openai/v1/`,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
    });
  }
  return _embeddingClient;
}

// Lazy-init for chat completions (can use API key or DefaultAzureCredential)
let _chatClient: OpenAI | null = null;
function getChatClient(): OpenAI | null {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
    return null;
  }
  if (!_chatClient) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
    const resourceName = new URL(endpoint).hostname.split(".")[0];
    _chatClient = new OpenAI({
      baseURL: `https://${resourceName}.openai.azure.com/openai/v1/`,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
    });
  }
  return _chatClient;
}

/**
 * Generate embedding vector for text.
 * Returns null if AI Foundry unavailable (fallback mode).
 */
export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  const client = getEmbeddingClient();
  if (!client) return null;

  try {
    const deploymentName =
      process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "text-embedding-3-small";
    const response = await client.embeddings.create({
      model: deploymentName,
      input: text,
    });
    return response.data[0].embedding;
  } catch (err) {
    console.log("[AI Foundry] Embedding failed:", (err as Error).message);
    return null;
  }
}

/**
 * Add post embedding to cache. Called after post creation.
 */
export async function addEmbedding(
  postId: string,
  text: string
): Promise<void> {
  const vector = await generateEmbedding(text);
  if (vector) {
    embeddingCache.set(postId, { postId, vector, text });
  }
}

/**
 * Remove embedding from cache (for expired posts)
 */
export function removeEmbedding(postId: string): void {
  embeddingCache.delete(postId);
}

/**
 * Get all embeddings (for semantic search)
 */
export function getAllEmbeddings(): PostEmbedding[] {
  return Array.from(embeddingCache.values());
}

/**
 * Generate Action Hint using gpt-4o-mini.
 * Returns null if generation fails.
 */
export async function generateActionHint(
  postText: string,
  searchResults: Array<{ title: string; description: string; sourceType: string }>
): Promise<string | null> {
  const client = getChatClient();
  if (!client) return null;

  try {
    const deploymentName =
      process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? "gpt-4o-mini";
    const response = await client.chat.completions.create({
      model: deploymentName,
      messages: [
        {
          role: "system",
          content:
            "Based on the search results provided, suggest ONE concrete next action in one sentence. Be specific — suggest a particular document to read, issue to check, or action to take. Write in the same language as the post text. Keep it concise and actionable.",
        },
        {
          role: "user",
          content: `Post: "${postText}"\n\nSearch results:\n${JSON.stringify(searchResults.slice(0, 3))}`,
        },
      ],
      max_tokens: 60,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.log("[AI Foundry] Action Hint failed:", (err as Error).message);
    return null;
  }
}
