// T014 + T019: POST /api/posts (create) + GET /api/posts (list with bbox + TTL filter)
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { auth } from "@/app/lib/auth";
import {
  validateCoordinates,
  calculateExpiresAt,
} from "@/app/lib/validation";
import { v4 as uuidv4 } from "uuid";
import { addEmbedding } from "@/app/lib/ai-foundry";

// T019: GET — list active posts with bbox filtering + TTL exclusion
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const swLat = parseFloat(searchParams.get("swLat") ?? "");
  const swLng = parseFloat(searchParams.get("swLng") ?? "");
  const neLat = parseFloat(searchParams.get("neLat") ?? "");
  const neLng = parseFloat(searchParams.get("neLng") ?? "");

  if ([swLat, swLng, neLat, neLng].some(isNaN)) {
    return NextResponse.json(
      { error: "Missing or invalid bbox parameters" },
      { status: 400 }
    );
  }

  const db = getDb();

  const posts = db
    .prepare(
      `SELECT p.*,
        COALESCE((SELECT COUNT(*) FROM engagements WHERE postId = p.id AND intent = 'interested'), 0) as interestedCount,
        COALESCE((SELECT COUNT(*) FROM engagements WHERE postId = p.id AND intent = 'join'), 0) as joinCount
      FROM posts p
      WHERE p.expiresAt > datetime('now')
        AND p.lat BETWEEN ? AND ?
        AND p.lng BETWEEN ? AND ?
      ORDER BY p.createdAt DESC`
    )
    .all(swLat, neLat, swLng, neLng);

  // Parse tags from JSON string
  const parsed = (posts as Record<string, unknown>[]).map((p) => ({
    ...p,
    tags: p.tags ? JSON.parse(p.tags as string) : [],
  }));

  return NextResponse.json({ posts: parsed });
}

// T014: POST — create a new post with validation
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, lat, lng, tags, ttl, mode } = body as {
    text?: string;
    lat?: number;
    lng?: number;
    tags?: string[];
    ttl?: string;
    mode?: string;
  };

  // Validate required fields
  if (!text || lat === undefined || lng === undefined || !ttl) {
    return NextResponse.json(
      { error: "Missing required fields: text, lat, lng, ttl" },
      { status: 400 }
    );
  }

  // Validate text length (max 300 chars)
  if (text.length > 300) {
    return NextResponse.json(
      { error: "Please keep your text within 300 characters.", code: "TEXT_TOO_LONG" },
      { status: 422 }
    );
  }

  // Validate coordinates (FR-020)
  if (!validateCoordinates(lat, lng)) {
    return NextResponse.json(
      { error: "Invalid coordinates" },
      { status: 400 }
    );
  }

  // Validate TTL
  const validTtls = ["1m", "24h", "72h", "7d"];
  if (!validTtls.includes(ttl)) {
    return NextResponse.json(
      { error: "Invalid TTL. Must be one of: 1m, 24h, 72h, 7d" },
      { status: 400 }
    );
  }

  // Validate tags
  if (tags && (!Array.isArray(tags) || tags.length > 5)) {
    return NextResponse.json(
      { error: "Tags must be an array with maximum 5 items" },
      { status: 400 }
    );
  }
  if (tags && tags.some((t: string) => typeof t !== "string" || t.length > 20)) {
    return NextResponse.json(
      { error: "Each tag must be a string of 20 characters or less" },
      { status: 400 }
    );
  }

  // Validate mode
  const validModes = ["online", "offline", "both"];
  const postMode = mode && validModes.includes(mode) ? mode : "both";

  const id = uuidv4();
  const expiresAt = calculateExpiresAt(ttl as "1m" | "24h" | "72h" | "7d");
  const createdAt = new Date().toISOString();

  const db = getDb();

  db.prepare(
    `INSERT INTO posts (id, authorId, authorName, text, tags, lat, lng, mode, createdAt, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    session.user.id,
    session.user.name ?? "Unknown",
    text,
    tags ? JSON.stringify(tags) : null,
    lat,
    lng,
    postMode,
    createdAt,
    expiresAt
  );

  // Generate embedding asynchronously (don't block response)
  addEmbedding(id, text).catch(() => {
    // Graceful: embedding failure doesn't block post creation
    console.log("[AI Foundry] Embedding generation failed for post", id);
  });

  const post = {
    id,
    authorId: session.user.id,
    authorName: session.user.name ?? "Unknown",
    text,
    tags: tags ?? [],
    lat,
    lng,
    mode: postMode,
    createdAt,
    expiresAt,
    interestedCount: 0,
    joinCount: 0,
  };

  return NextResponse.json(post, { status: 201 });
}
