// T028: search_docs tool — cosine similarity against sample docs
import { readFileSync } from "fs";
import { join } from "path";

interface SampleDoc {
  title: string;
  url: string;
  description: string;
  vector: number[];
}

let _docs: SampleDoc[] | null = null;

function loadDocs(): SampleDoc[] {
  if (!_docs) {
    const raw = readFileSync(
      join(__dirname, "..", "data", "sample-docs.json"),
      "utf-8"
    );
    _docs = JSON.parse(raw);
  }
  return _docs!;
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function searchDocs(queryVector: number[] | null): Array<{
  title: string;
  url: string;
  description: string;
  sourceType: "doc";
  status: "available";
}> {
  const docs = loadDocs();

  if (!queryVector) {
    // Fallback: return all docs if no vector available
    return docs.map((d) => ({
      title: d.title,
      url: d.url,
      description: d.description,
      sourceType: "doc" as const,
      status: "available" as const,
    }));
  }

  // Rank by cosine similarity and return top 3
  return docs
    .map((d) => ({
      ...d,
      score: cosineSim(queryVector, d.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((d) => ({
      title: d.title,
      url: d.url,
      description: d.description,
      sourceType: "doc" as const,
      status: "available" as const,
    }));
}
