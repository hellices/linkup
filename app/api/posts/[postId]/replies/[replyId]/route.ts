// T007: DELETE /api/posts/[postId]/replies/[replyId] — author-only delete
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { auth } from "@/app/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { postId: string; replyId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { postId, replyId } = params;
  const db = getDb();

  // Find the reply
  const reply = db
    .prepare(`SELECT id, authorId FROM replies WHERE id = ? AND postId = ?`)
    .get(replyId, postId) as { id: string; authorId: string } | undefined;

  if (!reply) {
    return NextResponse.json(
      { error: "Reply not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // Only the author can delete their own reply
  if (reply.authorId !== session.user.id) {
    return NextResponse.json(
      { error: "Not the reply author", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  db.prepare(`DELETE FROM replies WHERE id = ?`).run(replyId);

  return new NextResponse(null, { status: 204 });
}
