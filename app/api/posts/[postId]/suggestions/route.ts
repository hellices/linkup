// T033: GET /api/posts/[postId]/suggestions
// Fetches post → calls MCP + AI Foundry → combines docs/issues/posts + actionHint
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/app/lib/db";
import { getCombinedSuggestions } from "@/app/lib/mcp-client";
import { auth } from "@/app/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  const db = getDb();
  const post = db
    .prepare(
      `SELECT * FROM posts WHERE id = ? AND expiresAt > datetime('now')`
    )
    .get(postId) as { text: string } | undefined;

  if (!post) {
    return NextResponse.json(
      { error: "Post not found or expired" },
      { status: 404 }
    );
  }

  try {
    const session = await auth();
    const accessToken = session?.accessToken;
    const suggestions = await getCombinedSuggestions(post.text, postId, accessToken);
    return NextResponse.json(suggestions);
  } catch {
    // Full failure — graceful degrade
    return NextResponse.json({
      m365: [],
      docs: [],
      issues: [],
      posts: [],
      actionHint: null,
      source: "mcp",
      unavailableSources: ["m365", "docs", "issues", "posts"],
    });
  }
}
