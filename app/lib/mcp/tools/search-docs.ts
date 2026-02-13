// search_docs tool — searches documentation sources
// Currently returns empty results (no external doc source configured).
// When a real documentation API is integrated, implement the search logic here.

/**
 * Search docs for relevant resources.
 * Returns empty array when no documentation source is configured.
 */
export async function searchDocs(_query: string): Promise<Array<{
  title: string;
  url: string;
  description: string;
  sourceType: "doc";
  status: "available";
}>> {
  console.log("[search_docs] No documentation source configured — returning empty");
  return [];
}
