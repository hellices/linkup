// T030: search_posts tool — direct access to PostEmbedding cache (no HTTP callback!)
// This is the key benefit of in-process MCP: tools can access app memory directly.
import { generateEmbedding, getAllEmbeddings } from "@/app/lib/ai-foundry";
import { cosineSimilarity } from "@/app/lib/cosine";
import { getDb } from "@/app/lib/db";
import type { PostSummary } from "@/app/types";

/**
 * Search posts by embedding the query and comparing against PostEmbedding cache.
 * Direct in-process access — no HTTP callback needed.
 * On failure or empty cache, returns empty array (graceful degrade).
 */
export async function searchPosts(
  query: string,
  excludePostId?: string
): Promise<Array<{
  title: string;
  url: string;
  description: string;
  sourceType: "post";
  status: "available";
}>> {
  try {
    const queryVector = await generateEmbedding(query);
    if (!queryVector) {
      console.log("[search_posts] AI Foundry unavailable, returning empty");
      return [];
    }

    const allEmbeddings = getAllEmbeddings();
    if (allEmbeddings.length === 0) return [];

    // Cosine similarity against all post embeddings
    const scored = allEmbeddings
      .filter((e) => e.postId !== excludePostId)
      .map((e) => ({
        postId: e.postId,
        text: e.text,
        score: cosineSimilarity(queryVector, e.vector),
      }))
      .filter((e) => e.score >= 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length === 0) return [];

    // Fetch post details from DB
    const db = getDb();
    const postIds = scored.map((s) => s.postId);
    const placeholders = postIds.map(() => "?").join(",");
    const posts = db
      .prepare(
        `SELECT * FROM posts WHERE id IN (${placeholders}) AND expiresAt > datetime('now')`
      )
      .all(...postIds) as PostSummary[];

    return posts.slice(0, 5).map((p) => ({
      title: p.text.slice(0, 60) + (p.text.length > 60 ? "…" : ""),
      url: `/posts/${p.id}`,
      description: `Post at (${p.lat.toFixed(2)}, ${p.lng.toFixed(2)})${
        Array.isArray(p.tags) && p.tags.length ? ` — ${p.tags.join(", ")}` : ""
      }`,
      sourceType: "post" as const,
      status: "available" as const,
    }));
  } catch (err) {
    console.log("[search_posts] Error:", (err as Error).message);
    return [];
  }
}
