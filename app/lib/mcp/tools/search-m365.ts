// search_m365 tool — unified M365 internal resource search (OneDrive + SharePoint + Email)
// Calls Microsoft Graph Search API /search/query endpoint.
// Group 1 (v1.0): driveItem + listItem → OneDrive files, SharePoint docs
// Group 2 (v1.0): message              → Outlook emails
// Each group runs as a separate parallel request due to Graph API entity type combination rules.

import type { M365Source } from "@/app/types";

interface GraphSearchHit {
  hitId: string;
  rank: number;
  summary: string;
  resource: {
    "@odata.type": string;
    id: string;
    name?: string;
    subject?: string;
    webUrl?: string;
    lastModifiedDateTime?: string;
    from?: { emailAddress: { name: string; address: string } };
    bodyPreview?: string;
    receivedDateTime?: string;
  };
}

interface GraphSearchResponse {
  value: Array<{
    searchTerms: string[];
    hitsContainers: Array<{
      hits: GraphSearchHit[];
      total: number;
      moreResultsAvailable: boolean;
    }>;
  }>;
}

function determineSource(oDataType: string): M365Source {
  if (oDataType.includes("message")) return "email";
  if (oDataType.includes("listItem")) return "sharepoint";
  return "onedrive"; // driveItem
}

function extractTitle(hit: GraphSearchHit): string {
  const r = hit.resource;
  return r.subject ?? r.name ?? "Untitled";
}

function extractDescription(hit: GraphSearchHit): string {
  if (hit.summary) return hit.summary;
  const r = hit.resource;
  if (r.bodyPreview) return r.bodyPreview;
  return "";
}

function extractUrl(hit: GraphSearchHit): string {
  return hit.resource.webUrl ?? "";
}

type M365Result = {
  title: string;
  url: string;
  description: string;
  source: M365Source;
  sourceType: "m365";
  status: "available";
};

/**
 * Build a Graph Search request body for given entity types.
 */
function makeSearchRequest(entityTypes: string[], query: string) {
  return {
    requests: [
      {
        entityTypes,
        query: { queryString: query },
        from: 0,
        size: 10,
      },
    ],
  };
}

/**
 * Search M365 sources (OneDrive, SharePoint, Email) via Microsoft Graph Search API.
 *
 * Required scopes: Files.Read.All, Sites.Read.All, Mail.Read
 */
export async function searchM365(
  query: string,
  accessToken?: string
): Promise<M365Result[]> {
  if (!accessToken) {
    console.warn(
      "[search_m365] No access token provided — cannot call Graph API"
    );
    return [];
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const graphUrl = "https://graph.microsoft.com/v1.0/search/query";

  // Graph Search API does not allow mixing file/list types with message types
  // in a single request. Split into two parallel requests.
  const [filesRes, mailRes] = await Promise.allSettled([
    fetch(graphUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(
        makeSearchRequest(["driveItem", "listItem"], query)
      ),
    }),
    fetch(graphUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(
        makeSearchRequest(["message"], query)
      ),
    }),
  ]);

  const results: M365Result[] = [];
  const settled = [filesRes, mailRes];
  const groupLabels = ["files", "mail"];

  for (let idx = 0; idx < settled.length; idx++) {
    const s = settled[idx];
    if (s.status !== "fulfilled") {
      console.warn(
        `[search_m365] ${groupLabels[idx]} request failed:`,
        (s as PromiseRejectedResult).reason
      );
      continue;
    }
    const resp = s.value;
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(
        `[search_m365] ${groupLabels[idx]} Graph API error ${resp.status}: ${errorText}`
      );
      continue; // graceful partial failure — other group still returns
    }
    const data: GraphSearchResponse = await resp.json();
    for (const container of data.value ?? []) {
      for (const hitsContainer of container.hitsContainers ?? []) {
        for (const hit of hitsContainer.hits ?? []) {
          results.push({
            title: extractTitle(hit),
            url: extractUrl(hit),
            description: extractDescription(hit),
            source: determineSource(hit.resource["@odata.type"] ?? ""),
            sourceType: "m365",
            status: "available",
          });
        }
      }
    }
  }

  return results.slice(0, 10);
}
