// T030: search_posts tool — semantic search against PostEmbeddings via AI Foundry
// In MCP server context, this calls the app's /api/search or uses direct DB access
// For MVP simplicity, we return an empty array and let the app handle post search internally

export function searchPosts(
  _queryVector: number[] | null,
  _excludePostId?: string
): Array<{
  title: string;
  url: string;
  description: string;
  sourceType: "post";
  status: "available";
}> {
  // In the MCP server sidecar, we don't have direct access to the app's
  // embedding cache or DB. The app handles post-to-post similarity in
  // the /api/posts/[postId]/suggestions route directly.
  // Return empty here — the app merges post results from its own AI Foundry search.
  return [];
}
