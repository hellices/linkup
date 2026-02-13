// GET + POST /api/posts/[postId]/engagement — toggle engagement with participant names
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { auth } from "@/app/lib/auth";

interface EngagementRow {
  userId: string;
  userName: string;
  intent: string;
  createdAt: string;
}

/** Return the current user's engagement + participant lists for this post. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const session = await auth();
  const db = getDb();
  const { postId } = params;

  // Current user's intent
  let myIntent: string | null = null;
  if (session?.user?.id) {
    const row = db
      .prepare(`SELECT intent FROM engagements WHERE postId = ? AND userId = ?`)
      .get(postId, session.user.id) as { intent: string } | undefined;
    myIntent = row?.intent ?? null;
  }

  // Join participants (names visible to everyone)
  const joinParticipants = db
    .prepare(
      `SELECT userName, createdAt FROM engagements WHERE postId = ? AND intent = 'join' ORDER BY createdAt ASC`
    )
    .all(postId) as { userName: string; createdAt: string }[];

  const interestedCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM engagements WHERE postId = ? AND intent = 'interested'`
      )
      .get(postId) as { count: number }
  ).count;

  return NextResponse.json({
    intent: myIntent,
    interestedCount,
    joinCount: joinParticipants.length,
    joinParticipants: joinParticipants.map((p) => ({
      name: p.userName,
      joinedAt: p.createdAt,
    })),
  });
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

  // Toggle: if user already has the same intent, remove it; otherwise upsert
  const existing = db
    .prepare(`SELECT intent FROM engagements WHERE postId = ? AND userId = ?`)
    .get(postId, session.user.id) as { intent: string } | undefined;

  let currentIntent: string | null;
  const userName = session.user.name ?? "Unknown";

  if (existing?.intent === intent) {
    // Same intent clicked again → toggle OFF (remove engagement)
    db.prepare(`DELETE FROM engagements WHERE postId = ? AND userId = ?`).run(
      postId,
      session.user.id
    );
    currentIntent = null;
  } else {
    // Different intent or no existing → upsert
    db.prepare(
      `INSERT OR REPLACE INTO engagements (postId, userId, userName, intent, createdAt)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(postId, session.user.id, userName, intent);
    currentIntent = intent;
  }

  // Get updated counts + join participants
  const interestedCount = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM engagements WHERE postId = ? AND intent = 'interested'`
      )
      .get(postId) as { count: number }
  ).count;

  const joinParticipants = db
    .prepare(
      `SELECT userName, createdAt FROM engagements WHERE postId = ? AND intent = 'join' ORDER BY createdAt ASC`
    )
    .all(postId) as { userName: string; createdAt: string }[];

  return NextResponse.json({
    intent: currentIntent,
    interestedCount,
    joinCount: joinParticipants.length,
    joinParticipants: joinParticipants.map((p) => ({
      name: p.userName,
      joinedAt: p.createdAt,
    })),
  });
}
