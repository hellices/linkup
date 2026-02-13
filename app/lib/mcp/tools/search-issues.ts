// search_issues tool — searches issue tracking sources
// Currently returns empty results (no external issue source configured).
// When a real issue tracker API (e.g. GitHub Issues) is integrated, implement the search logic here.

/**
 * Search issues for relevant problems and solutions.
 * Returns empty array when no issue source is configured.
 */
export async function searchIssues(_query: string): Promise<Array<{
  title: string;
  url: string;
  description: string;
  sourceType: "issue";
  status: "available";
}>> {
  console.log("[search_issues] No issue source configured — returning empty");
  return [];
}
