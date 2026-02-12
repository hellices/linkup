// search_m365 tool — unified M365 internal resource search (OneDrive + SharePoint + Email)
// Single tool replaces separate search_onedrive/search_sharepoint/search_email
// In production, this would call Microsoft Graph API's unified search endpoint.
// For MVP, uses pre-embedded sample data with cosine similarity.
import { readFileSync } from "fs";
import { join } from "path";
import { generateEmbedding } from "@/app/lib/ai-foundry";
import { cosineSimilarity } from "@/app/lib/cosine";

interface SampleM365Item {
  title: string;
  url: string;
  description: string;
  source: "onedrive" | "sharepoint" | "email";
  vector: number[];
}

let _items: SampleM365Item[] | null = null;

function loadItems(): SampleM365Item[] {
  if (!_items) {
    const raw = readFileSync(
      join(process.cwd(), "app", "lib", "mcp", "data", "sample-m365.json"),
      "utf-8"
    );
    _items = JSON.parse(raw);
  }
  return _items!;
}

/**
 * Search all M365 sources (OneDrive, SharePoint, Email) in a single call.
 * Results are tagged with their source for UI grouping.
 * Fallback: if AI Foundry is unavailable, return all items.
 */
export async function searchM365(query: string): Promise<Array<{
  title: string;
  url: string;
  description: string;
  source: "onedrive" | "sharepoint" | "email";
  sourceType: "m365";
  status: "available";
}>> {
  const items = loadItems();

  const queryVector = await generateEmbedding(query);

  if (!queryVector) {
    console.log("[search_m365] AI Foundry unavailable, returning all items");
    return items.map((item) => ({
      title: item.title,
      url: item.url,
      description: item.description,
      source: item.source,
      sourceType: "m365" as const,
      status: "available" as const,
    }));
  }

  return items
    .map((item) => ({
      ...item,
      score: cosineSimilarity(queryVector, item.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => ({
      title: item.title,
      url: item.url,
      description: item.description,
      source: item.source,
      sourceType: "m365" as const,
      status: "available" as const,
    }));
}
