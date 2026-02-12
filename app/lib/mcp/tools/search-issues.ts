// T029: search_issues tool — uses app's ai-foundry for embeddings + cosine utility
import { readFileSync } from "fs";
import { join } from "path";
import { generateEmbedding } from "@/app/lib/ai-foundry";
import { cosineSimilarity } from "@/app/lib/cosine";

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
      join(process.cwd(), "app", "lib", "mcp", "data", "sample-issues.json"),
      "utf-8"
    );
    _issues = JSON.parse(raw);
  }
  return _issues!;
}

/**
 * Search issues by embedding the query and comparing against pre-embedded issues.
 * Fallback: if AI Foundry is unavailable, return all issues.
 */
export async function searchIssues(query: string): Promise<Array<{
  title: string;
  url: string;
  description: string;
  sourceType: "issue";
  status: "available";
}>> {
  const issues = loadIssues();

  const queryVector = await generateEmbedding(query);

  if (!queryVector) {
    console.log("[search_issues] AI Foundry unavailable, returning all issues");
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
      score: cosineSimilarity(queryVector, d.vector),
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
