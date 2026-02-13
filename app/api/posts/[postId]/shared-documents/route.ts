// T005+T006: GET (paginated list) + POST (share document)
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/app/lib/db";
import { auth } from "@/app/lib/auth";
import type { SharedDocument, PaginatedResponse } from "@/app/types";

const PAGE_SIZE = 5;
const VALID_SOURCE_TYPES = ["onedrive", "sharepoint", "email", "link"] as const;

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

  // Check post exists (active or expired — shared docs remain visible)
  const post = db.prepare(`SELECT id FROM posts WHERE id = ?`).get(postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const cursorParam = req.nextUrl.searchParams.get("cursor");
  let rows: SharedDocument[];

  if (cursorParam) {
    const cursor = decodeCursor(cursorParam);
    if (!cursor) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    // Keyset pagination: oldest first (ASC) — fetch items newer than cursor
    rows = db
      .prepare(
        `SELECT id, postId, sharerId, sharerName, title, url, sourceType, createdAt
         FROM shared_documents
         WHERE postId = ?
           AND (createdAt > ? OR (createdAt = ? AND id > ?))
         ORDER BY createdAt ASC, id ASC
         LIMIT ?`
      )
      .all(postId, cursor.createdAt, cursor.createdAt, cursor.id, PAGE_SIZE + 1) as SharedDocument[];
  } else {
    // First page — no cursor
    rows = db
      .prepare(
        `SELECT id, postId, sharerId, sharerName, title, url, sourceType, createdAt
         FROM shared_documents
         WHERE postId = ?
         ORDER BY createdAt ASC, id ASC
         LIMIT ?`
      )
      .all(postId, PAGE_SIZE + 1) as SharedDocument[];
  }

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
      db.prepare(`SELECT COUNT(*) as count FROM shared_documents WHERE postId = ?`).get(postId) as { count: number }
    ).count;
  }

  const response: PaginatedResponse<SharedDocument> = { items, nextCursor, hasMore, ...(totalCount !== undefined && { totalCount }) };
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

  const { title, url, sourceType } = body as {
    title?: string;
    url?: string;
    sourceType?: string;
  };

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Document title is required", code: "INVALID_TITLE" },
      { status: 400 }
    );
  }
  if (title.trim().length > 500) {
    return NextResponse.json(
      { error: "Title must not exceed 500 characters", code: "TITLE_TOO_LONG" },
      { status: 400 }
    );
  }
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    return NextResponse.json(
      { error: "Document URL is required", code: "INVALID_URL" },
      { status: 400 }
    );
  }
  if (
    !sourceType ||
    typeof sourceType !== "string" ||
    !VALID_SOURCE_TYPES.includes(sourceType as typeof VALID_SOURCE_TYPES[number])
  ) {
    return NextResponse.json(
      { error: "sourceType must be one of: onedrive, sharepoint, email, link", code: "INVALID_SOURCE_TYPE" },
      { status: 400 }
    );
  }

  // Check for duplicate URL on this post (FR-010)
  const existing = db
    .prepare(`SELECT id FROM shared_documents WHERE postId = ? AND url = ?`)
    .get(postId, url.trim());
  if (existing) {
    return NextResponse.json(
      { error: "Document URL already shared on this post", code: "DUPLICATE_URL" },
      { status: 409 }
    );
  }

  const id = uuidv4();
  const sharerId = session.user.id;
  const sharerName = session.user.name ?? "Unknown";

  db.prepare(
    `INSERT INTO shared_documents (id, postId, sharerId, sharerName, title, url, sourceType, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, postId, sharerId, sharerName, title.trim(), url.trim(), sourceType);

  const doc = db
    .prepare(
      `SELECT id, postId, sharerId, sharerName, title, url, sourceType, createdAt
       FROM shared_documents WHERE id = ?`
    )
    .get(id) as SharedDocument;

  return NextResponse.json(doc, { status: 201 });
}
