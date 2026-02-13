// T003+T004: GET (paginated list) + POST (create reply)
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/app/lib/db";
import { auth } from "@/app/lib/auth";
import type { Reply, PaginatedResponse } from "@/app/types";

const PAGE_SIZE = 5;

/** Decode a base64url cursor into { createdAt, id } */
function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const [createdAt, id] = decoded.split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Encode { createdAt, id } into a base64url cursor */
function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString("base64url");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const { postId } = params;
  const db = getDb();

  // Check post exists (active or expired — replies remain visible per spec)
  const post = db.prepare(`SELECT id FROM posts WHERE id = ?`).get(postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const cursorParam = req.nextUrl.searchParams.get("cursor");
  let rows: Reply[];

  if (cursorParam) {
    const cursor = decodeCursor(cursorParam);
    if (!cursor) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    // Keyset pagination: newest first (DESC) — fetch items older than cursor
    rows = db
      .prepare(
        `SELECT id, postId, authorId, authorName, text, createdAt
         FROM replies
         WHERE postId = ?
           AND (createdAt < ? OR (createdAt = ? AND id < ?))
         ORDER BY createdAt DESC, id DESC
         LIMIT ?`
      )
      .all(postId, cursor.createdAt, cursor.createdAt, cursor.id, PAGE_SIZE + 1) as Reply[];
  } else {
    // First page — no cursor
    rows = db
      .prepare(
        `SELECT id, postId, authorId, authorName, text, createdAt
         FROM replies
         WHERE postId = ?
         ORDER BY createdAt DESC, id DESC
         LIMIT ?`
      )
      .all(postId, PAGE_SIZE + 1) as Reply[];
  }

  // LIMIT N+1 pattern: if we got more than PAGE_SIZE, there are more items
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? encodeCursor(lastItem.createdAt, lastItem.id)
    : null;

  // Total count for header display (only on first page)
  let totalCount: number | undefined;
  if (!cursorParam) {
    totalCount = (
      db.prepare(`SELECT COUNT(*) as count FROM replies WHERE postId = ?`).get(postId) as { count: number }
    ).count;
  }

  const response: PaginatedResponse<Reply> = { items, nextCursor, hasMore, ...(totalCount !== undefined && { totalCount }) };
  return NextResponse.json(response);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { postId } = params;
  const db = getDb();

  // Check post exists and is not expired
  const post = db
    .prepare(`SELECT id FROM posts WHERE id = ? AND expiresAt > datetime('now')`)
    .get(postId);
  if (!post) {
    return NextResponse.json(
      { error: "Post not found or expired" },
      { status: 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body as { text?: string };
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      { error: "Reply text is required", code: "INVALID_TEXT" },
      { status: 400 }
    );
  }
  if (text.trim().length > 500) {
    return NextResponse.json(
      { error: "Reply text must not exceed 500 characters", code: "TEXT_TOO_LONG" },
      { status: 400 }
    );
  }

  const id = uuidv4();
  const authorId = session.user.id;
  const authorName = session.user.name ?? "Unknown";

  db.prepare(
    `INSERT INTO replies (id, postId, authorId, authorName, text, createdAt)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, postId, authorId, authorName, text.trim());

  // Fetch the inserted row to get server-set createdAt
  const reply = db
    .prepare(`SELECT id, postId, authorId, authorName, text, createdAt FROM replies WHERE id = ?`)
    .get(id) as Reply;

  return NextResponse.json(reply, { status: 201 });
}
