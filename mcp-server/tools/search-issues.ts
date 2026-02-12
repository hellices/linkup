// T029: search_issues tool — cosine similarity against sample issues
import { readFileSync } from "fs";
import { join } from "path";

interface SampleIssue {
  title: string;
  url: string;
  description: string;
  vector: number[];
}

let _issues: SampleIssue[] | null = null;

function loadIssues(): SampleIssue[] {
  if (!_issues) {
    const raw = readFileSync(
      join(__dirname, "..", "data", "sample-issues.json"),
      "utf-8"
    );
    _issues = JSON.parse(raw);
  }
  return _issues!;
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

export function searchIssues(queryVector: number[] | null): Array<{
  title: string;
  url: string;
  description: string;
  sourceType: "issue";
  status: "available";
}> {
  const issues = loadIssues();

  if (!queryVector) {
    return issues.map((d) => ({
      title: d.title,
      url: d.url,
      description: d.description,
      sourceType: "issue" as const,
      status: "available" as const,
    }));
  }

  return issues
    .map((d) => ({
      ...d,
      score: cosineSim(queryVector, d.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((d) => ({
      title: d.title,
      url: d.url,
      description: d.description,
      sourceType: "issue" as const,
      status: "available" as const,
    }));
}
