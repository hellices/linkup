// T003: Shared TypeScript types per data-model.md

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  tags: string[];
  lat: number;
  lng: number;
  mode: "online" | "offline" | "both";
  createdAt: string;
  expiresAt: string;
}

export interface PostSummary extends Post {
  interestedCount: number;
  joinCount: number;
}

export interface Engagement {
  postId: string;
  userId: string;
  intent: "interested" | "join";
  createdAt: string;
}

/** M365 sub-source identifier for UI icon/grouping */
export type M365Source =
  | "onedrive"
  | "sharepoint"
  | "email";

export interface McpSuggestion {
  title: string;
  url: string;
  description: string;
  sourceType: "m365" | "post";
  /** M365 sub-source for UI icon/grouping (only present when sourceType === "m365") */
  source?: M365Source;
  status: "available" | "unavailable";
}

export interface CombinedSuggestionsResponse {
  /** PRIMARY — M365 internal resources (OneDrive/SharePoint/Email unified) */
  m365: McpSuggestion[];
  /** Related posts */
  posts: PostSummary[];
  actionHint: string | null;
  source: "mcp";
  unavailableSources: string[];
}

export interface SemanticSearchResponse {
  posts: PostSummary[];
  outOfBounds: number;
  query: string;
}

export interface PostEmbedding {
  postId: string;
  vector: number[];
  text: string;
}

export interface CreatePostRequest {
  text: string;
  lat: number;
  lng: number;
  tags?: string[];
  ttl: "1m" | "24h" | "72h" | "7d";
  mode?: "online" | "offline" | "both";
}
