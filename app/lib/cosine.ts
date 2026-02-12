// T024: Cosine similarity utility

/**
 * Calculate cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Find top-k most similar items by cosine similarity.
 */
export function findTopK<T>(
  queryVector: number[],
  items: Array<{ vector: number[]; item: T }>,
  k: number,
  minScore = 0.3
): Array<{ item: T; score: number }> {
  const scored = items
    .map(({ vector, item }) => ({
      item,
      score: cosineSimilarity(queryVector, vector),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored;
}
