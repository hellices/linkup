# Data Model: Post Replies & Document Sharing

**Feature**: `005-post-replies-docs`  
**Date**: 2026-02-13

## New Entities

### Reply

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID v4) | PK, NOT NULL | Unique reply identifier |
| postId | string (UUID) | NOT NULL, FK → posts(id) ON DELETE CASCADE | Parent post |
| authorId | string | NOT NULL | Entra ID user identifier (OID) |
| authorName | string | NOT NULL | Display name (from session) |
| text | string | NOT NULL, min 1 char, max 500 chars | Reply body |
| createdAt | datetime (ISO 8601) | NOT NULL, server-set | Creation timestamp |

**Validation Rules**:
- `text`: 1–500 characters, no empty/whitespace-only strings
- `postId`: Must reference an existing, non-expired post
- `authorId`: Only authenticated users (Entra ID session required)

**State Transitions**:
- `active` → `deleted`: When the author deletes their own reply (hard delete)
- `active` → `cascade-deleted`: Automatically removed when the parent post expires and is deleted (Constitution 2.1 — Mandatory TTL via ON DELETE CASCADE)

**Sort Order**: Reverse-chronological (newest first) — `ORDER BY createdAt DESC, id DESC`

### SharedDocument

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID v4) | PK, NOT NULL | Unique shared-document identifier |
| postId | string (UUID) | NOT NULL, FK → posts(id) ON DELETE CASCADE | Parent post |
| sharerId | string | NOT NULL | Entra ID user identifier (OID) of the sharer |
| sharerName | string | NOT NULL | Display name of the sharer (from session) |
| title | string | NOT NULL | M365 document title (from MCP suggestion) |
| url | string (URI) | NOT NULL | M365 document URL (from MCP suggestion) |
| sourceType | enum(onedrive, sharepoint, email, link) | NOT NULL | Source type (M365 sub-source or user-submitted link) |
| createdAt | datetime (ISO 8601) | NOT NULL, server-set | Share timestamp |

**Validation Rules**:
- `url`: Must be a non-empty string; structural URL validation is not enforced (M365 URLs vary in format)
- `title`: Must be a non-empty string, max 500 characters
- Uniqueness: `(postId, url)` — same URL cannot be shared twice on the same post (FR-010)
- `postId`: Must reference an existing, non-expired post
- `sharerId`: Only authenticated users (Entra ID session required)

**State Transitions**:
- `active` → `cascade-deleted`: Automatically removed when the parent post expires and is deleted (Constitution 2.1)

**Sort Order**: Chronological (oldest first) — `ORDER BY createdAt ASC, id ASC`

## Relationships

```text
Post 1 ──── * Reply
  │              │
  │              │ authorId → (Entra ID User, not stored as entity)
  │              │
  ├──── * SharedDocument
  │              │
  │              │ sharerId → (Entra ID User, not stored as entity)
  │              │
  ├──── * Engagement  (existing)
  │
  └──── 0..1 PostEmbedding  (existing, in-memory cache)
```

- 1 Post → N Replies (a post has many replies)
- 1 Post → N SharedDocuments (a post has many shared documents)
- 1 User → N Replies (a user can reply to many posts, and multiple times per post)
- 1 User → N SharedDocuments (a user can share documents on many posts)
- SharedDocument is unique per `(postId, url)` — prevents duplicates

## Aggregated Views

### Reply List with Pagination

| Derived Field | Computation |
|---------------|-------------|
| items | Top N replies by `createdAt DESC` from cursor position |
| nextCursor | base64url(`createdAt\|id`) of the last item, or null |
| hasMore | true if more items exist beyond the current page |

### SharedDocument List with Pagination

| Derived Field | Computation |
|---------------|-------------|
| items | Top N shared documents by `createdAt ASC` from cursor position |
| nextCursor | base64url(`createdAt\|id`) of the last item, or null |
| hasMore | true if more items exist beyond the current page |

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  postId TEXT NOT NULL,
  authorId TEXT NOT NULL,
  authorName TEXT NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shared_documents (
  id TEXT PRIMARY KEY,
  postId TEXT NOT NULL,
  sharerId TEXT NOT NULL,
  sharerName TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  sourceType TEXT NOT NULL CHECK (sourceType IN ('onedrive', 'sharepoint', 'email', 'link')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
  UNIQUE (postId, url)
);

CREATE INDEX IF NOT EXISTS idx_replies_post_created ON replies(postId, createdAt DESC, id);
CREATE INDEX IF NOT EXISTS idx_shared_docs_post_created ON shared_documents(postId, createdAt ASC, id);
```

## TypeScript Types (additions to `app/types/index.ts`)

```typescript
export interface Reply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface SharedDocument {
  id: string;
  postId: string;
  sharerId: string;
  sharerName: string;
  title: string;
  url: string;
  sourceType: M365Source;  // reuses existing "onedrive" | "sharepoint" | "email"
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
```
