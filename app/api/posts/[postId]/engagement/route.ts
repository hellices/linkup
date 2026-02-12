// T039: POST /api/posts/[postId]/engagement — idempotent upsert
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { auth } from "@/app/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { postId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { intent } = body as { intent?: string };
  if (!intent || !["interested", "join"].includes(intent)) {
    return NextResponse.json(
      { error: "Intent must be 'interested' or 'join'" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Check post exists and is not expired
  const post = db
    .prepare(
      `SELECT id FROM posts WHERE id = ? AND expiresAt > datetime('now')`
    )
    .get(postId);

  if (!post) {
    return NextResponse.json(
      { error: "Post not found or expired" },
      { status: 404 }
    );
  }

  // Idempotent upsert — INSERT OR REPLACE on (postId, userId) unique constraint
  db.prepare(
    `INSERT OR REPLACE INTO engagements (postId, userId, intent, createdAt)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(postId, session.user.id, intent);

  // Get updated counts
  const interestedCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM engagements WHERE postId = ? AND intent = 'interested'`
      )
      .get(postId) as { count: number }
  ).count;

  const joinCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM engagements WHERE postId = ? AND intent = 'join'`
      )
      .get(postId) as { count: number }
  ).count;

  return NextResponse.json({
    intent,
    interestedCount,
    joinCount,
  });
}
