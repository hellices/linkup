// T028: search_docs tool — uses app's ai-foundry for embeddings + cosine utility
import { readFileSync } from "fs";
import { join } from "path";
import { generateEmbedding } from "@/app/lib/ai-foundry";
import { cosineSimilarity } from "@/app/lib/cosine";

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
      join(process.cwd(), "app", "lib", "mcp", "data", "sample-docs.json"),
      "utf-8"
    );
    _docs = JSON.parse(raw);
  }
  return _docs!;
}

/**
 * Search docs by embedding the query and comparing against pre-embedded docs.
 * Fallback: if AI Foundry is unavailable, return all docs.
 */
export async function searchDocs(query: string): Promise<Array<{
  title: string;
  url: string;
  description: string;
  sourceType: "doc";
  status: "available";
}>> {
  const docs = loadDocs();

  const queryVector = await generateEmbedding(query);

  if (!queryVector) {
    console.log("[search_docs] AI Foundry unavailable, returning all docs");
    return docs.map((d) => ({
      title: d.title,
      url: d.url,
      description: d.description,
      sourceType: "doc" as const,
      status: "available" as const,
    }));
  }

  return docs
    .map((d) => ({
      ...d,
      score: cosineSimilarity(queryVector, d.vector),
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
