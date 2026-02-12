# Data Model: LinkUp Map-First MVP + AI Foundry + MCP

**Feature**: `001-map-first-mvp`
**Date**: 2026-02-12 (Updated: 2026-02-12)

## Entities

### Post

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID v4) | PK, NOT NULL | Unique post identifier |
| authorId | string | NOT NULL | Entra ID user identifier (OID) |
| authorName | string | NOT NULL | Display user name (extracted from session) |
| text | string | NOT NULL, max 500 chars, ≤ 3 sentences | Post body (3-sentence limit) |
| tags | string[] | optional, max 5 tags | Tag list (e.g., "AKS", "Entra") |
| lat | number (float) | NOT NULL, -90 ≤ lat ≤ 90 | Latitude |
| lng | number (float) | NOT NULL, -180 ≤ lng ≤ 180 | Longitude |
| mode | enum(online, offline, both) | optional, default: "both" | Collaboration mode |
| createdAt | datetime (ISO 8601) | NOT NULL, server-set | Creation time |
| expiresAt | datetime (ISO 8601) | NOT NULL | Expiration time (TTL-based calculation) |

**Validation Rules**:
- `text`: 3 sentences or fewer. Sentences are counted by `.`, `?`, `!` delimiters, excluding dots within URLs and ellipsis (`...`)
- `expiresAt`: Must be in the future relative to `createdAt`. TTL options: 24h / 72h / 7d / 1min (for demo)
- `tags`: Each tag is 20 characters or fewer, maximum 5
- `lat`/`lng`: Within valid coordinate range

**State Transitions**:
- `active` → `expired`: Automatically transitions when `expiresAt < now()` condition is met (filtered at query time)

### Engagement

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| postId | string (UUID) | NOT NULL, FK → Post.id | Target post |
| userId | string | NOT NULL | Participant's Entra ID OID |
| intent | enum(interested, join) | NOT NULL | Engagement intent |
| createdAt | datetime (ISO 8601) | NOT NULL, server-set | Engagement time |

**Uniqueness**: `(postId, userId)` — Only one record per user-post combination.
When upgrading from Interested → Join, the existing record's `intent` field is UPDATEd (INSERT OR REPLACE).

**Validation Rules**:
- `intent`: Only "interested" or "join" allowed
- `postId`: Must be an existing, non-expired post
- `userId`: Only authenticated users can create

### PostEmbedding (In-Memory — Next.js App Process Only)

> Not stored in SQLite; managed as a runtime in-memory cache **within the Next.js app process**.
> Regenerated on process restart.
> **The MCP server runs as an internal app module, so it can directly access this cache** — the `search_posts` tool
> directly calls `getAllEmbeddings()` to perform semantic search.

| Field | Type | Description |
|-------|------|-------------|
| postId | string (UUID) | Target post ID |
| vector | number[] (1536 dims) | `text-embedding-3-small` embedding vector |
| text | string | Original post text (for displaying cosine similarity results) |

**Creation timing**: Embedding is generated asynchronously on post creation → stored in cache
**Expiration**: Removed from cache when the post's TTL expires

### MCP Combined Result (API response only, not persisted)

> Runtime data structure not stored in DB. Used only as an API response.
> **Created by**: The MCP server (internal app module) uses the app's AI Foundry client to perform unified search of M365 internal resources (OneDrive/SharePoint/Email) as **primary**,
> searches docs/issues as supplementary, directly accesses the PostEmbedding cache to search posts,
> and generates actionHint via GPT-4o-mini.
> The Next.js app's MCP client (`lib/mcp-client.ts`) combines these results via InMemoryTransport.

| Field | Type | Description |
|-------|------|-------------|
| m365 | McpSuggestion[] | MCP `search_m365` results (0–5) — **primary** (OneDrive/SharePoint/Email unified) |
| docs | McpSuggestion[] | MCP `search_docs` results (0–3) — supplementary |
| issues | McpSuggestion[] | MCP `search_issues` results (0–2) — supplementary |
| posts | PostSummary[] | AI Foundry semantic search results (0–5) |
| actionHint | string \| null | One-line Action Hint (null on generation failure) |
| source | "mcp" | Always "mcp" — for UI label display |

### McpSuggestion (Individual suggestion item)

| Field | Type | Description |
|-------|------|-------------|
| title | string | Resource title |
| url | string (URI) | Resource link |
| description | string | One-line summary |
| sourceType | "m365" \| "doc" \| "issue" \| "post" | Source category (M365 primary, web supplementary) |
| source | "onedrive" \| "sharepoint" \| "email" (optional) | M365 sub-source (present when sourceType="m365") |
| status | "available" \| "unavailable" | Source query success status |

### SemanticSearchResult (Map search response, not persisted)

> AI Foundry semantic search + bbox re-filtering results for map search.

| Field | Type | Description |
|-------|------|-------------|
| posts | PostSummary[] | Bbox-filtered semantic search results |
| outOfBounds | number | Count of results outside bbox (displays "N results outside map" in UI) |
| query | string | Original search query |

## Relationships

```text
Post 1 ──── * Engagement
  │                │
  │ authorId       │ userId
  │                │
  └── (Entra ID User: not stored as entity, resolved from session)

Post 1 ──── 0..1 PostEmbedding  (in-memory cache, async generation)

MCP Combined Result (runtime composition):
  ├── m365[]       ← MCP search_m365       (PRIMARY — OneDrive/SharePoint/Email unified)
  ├── docs[]       ← MCP search_docs       (supplementary)
  ├── issues[]     ← MCP search_issues     (supplementary)
  ├── posts[]      ← AI Foundry semantic search (PostSummary[])
  └── actionHint   ← gpt-4o-mini or template
```

- 1 Post → N Engagements (multiple users engage with one post)
- 1 User → N Engagements (one user engages with multiple posts)
- 1 User → N Posts (one user creates multiple posts)
- 1 Post → 0..1 PostEmbedding (may be absent before embedding generation or on failure)
- MCP Combined Result is dynamically generated per request, not stored

## Aggregated Views

### Post with Engagement Counts (for popup display)

| Derived Field | Computation |
|---------------|-------------|
| interestedCount | COUNT(Engagement WHERE postId = ? AND intent = 'interested') |
| joinCount | COUNT(Engagement WHERE postId = ? AND intent = 'join') |
| currentUserIntent | Engagement.intent WHERE postId = ? AND userId = currentUser (nullable) |
| timeRemaining | expiresAt - now() |

## SQLite Schema (Implementation Reference)

```sql
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  authorId TEXT NOT NULL,
  authorName TEXT NOT NULL,
  text TEXT NOT NULL,
  tags TEXT,  -- JSON array stored as text
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  mode TEXT DEFAULT 'both',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  expiresAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS engagements (
  postId TEXT NOT NULL,
  userId TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('interested', 'join')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (postId, userId),
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_expires ON posts(expiresAt);
CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(lat, lng);
```
