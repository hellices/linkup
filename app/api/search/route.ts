// T034: GET /api/search — AI Foundry semantic search + bbox refiltering
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { generateEmbedding, getAllEmbeddings, getEmbeddingCacheSize, warmupEmbeddings } from "@/app/lib/ai-foundry";
import { findTopK } from "@/app/lib/cosine";
import type { PostSummary } from "@/app/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q") ?? "";
  const swLat = parseFloat(searchParams.get("swLat") ?? "");
  const swLng = parseFloat(searchParams.get("swLng") ?? "");
  const neLat = parseFloat(searchParams.get("neLat") ?? "");
  const neLng = parseFloat(searchParams.get("neLng") ?? "");
  const limit = parseInt(searchParams.get("limit") ?? "10", 10);

  if (!query.trim()) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }
  if ([swLat, swLng, neLat, neLng].some(isNaN)) {
    return NextResponse.json({ error: "Missing or invalid bbox parameters" }, { status: 400 });
  }

  // Warm up embedding cache with existing posts on first search (non-blocking)
  if (getEmbeddingCacheSize() === 0) {
    const db = getDb();
    const existingPosts = db
      .prepare(`SELECT id, text FROM posts WHERE expiresAt > datetime('now')`)
      .all() as { id: string; text: string }[];
    if (existingPosts.length > 0) {
      // Fire-and-forget: don't block the first search request
      warmupEmbeddings(existingPosts).catch(() => {});
    }
  }

  // Generate query embedding
  const queryVector = await generateEmbedding(query);
  if (!queryVector) {
    // Fallback: text-based search if AI Foundry unavailable
    const db = getDb();
    const posts = db
      .prepare(
        `SELECT p.*,
          COALESCE((SELECT COUNT(*) FROM engagements WHERE postId = p.id AND intent = 'interested'), 0) as interestedCount,
          COALESCE((SELECT COUNT(*) FROM engagements WHERE postId = p.id AND intent = 'join'), 0) as joinCount
        FROM posts p
        WHERE p.expiresAt > datetime('now')
          AND p.text LIKE ?
          AND p.lat BETWEEN ? AND ? AND p.lng BETWEEN ? AND ?
        LIMIT ?`
      )
      .all(`%${query}%`, swLat, neLat, swLng, neLng, limit) as PostSummary[];

    return NextResponse.json({
      posts: posts.map((p) => ({ ...p, tags: p.tags ? JSON.parse(p.tags as unknown as string) : [] })),
      outOfBounds: 0,
      query,
    });
  }

  // Find similar posts via cosine similarity
  const allEmbeddings = getAllEmbeddings();
  const items = allEmbeddings.map((e) => ({ vector: e.vector, item: e }));
  const topResults = findTopK(queryVector, items, limit + 20, 0.2);

  // Get post details from DB
  const db = getDb();
  const postIds = topResults.map((r) => r.item.postId);
  if (postIds.length === 0) {
    return NextResponse.json({ posts: [], outOfBounds: 0, query });
  }

  const placeholders = postIds.map(() => "?").join(",");
  const allPosts = db
    .prepare(
      `SELECT p.*,
        COALESCE((SELECT COUNT(*) FROM engagements WHERE postId = p.id AND intent = 'interested'), 0) as interestedCount,
        COALESCE((SELECT COUNT(*) FROM engagements WHERE postId = p.id AND intent = 'join'), 0) as joinCount
      FROM posts p
      WHERE p.id IN (${placeholders})
        AND p.expiresAt > datetime('now')`
    )
    .all(...postIds) as (PostSummary & { tags: string })[];

  // Split into in-bbox and out-of-bbox
  const inBbox: PostSummary[] = [];
  const outOfBbox: PostSummary[] = [];

  allPosts.forEach((p) => {
    const parsed: PostSummary = { ...p, tags: p.tags ? JSON.parse(p.tags) : [] };
    if (
      p.lat >= swLat && p.lat <= neLat &&
      p.lng >= swLng && p.lng <= neLng
    ) {
      inBbox.push(parsed);
    } else {
      outOfBbox.push(parsed);
    }
  });

  return NextResponse.json({
    posts: inBbox.slice(0, limit),
    outOfBounds: outOfBbox.length,
    query,
  });
}
