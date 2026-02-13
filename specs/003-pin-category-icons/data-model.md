# Data Model: Pin Category Icons & Clustering

**Feature**: 003-pin-category-icons  
**Date**: 2026-02-13  
**Source**: [spec.md](spec.md), [research.md](research.md)

---

## Entity Changes

### 1. Post (extended)

The existing `Post` entity gains a `category` field.

#### Schema Change (SQLite)

```sql
-- New column on existing posts table
ALTER TABLE posts ADD COLUMN category TEXT DEFAULT 'discussion'
  CHECK (category IN ('question', 'discussion', 'share', 'help', 'meetup'));
```

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `category` | `TEXT` | `NOT NULL DEFAULT 'discussion'`, `CHECK(IN(...))` | Added column. Existing rows auto-default to `discussion` (FR-009). |

All other Post columns remain unchanged.

#### TypeScript Type Update

```typescript
// app/types/index.ts — Post interface extension
export type PostCategory = "question" | "discussion" | "share" | "help" | "meetup";

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  tags: string[];
  lat: number;
  lng: number;
  mode: "online" | "offline" | "both";
  category: PostCategory;           // NEW — defaults to "discussion"
  createdAt: string;
  expiresAt: string;
}
```

#### Validation Rules

- `category` must be one of: `question`, `discussion`, `share`, `help`, `meetup`.
- If omitted in POST request, defaults to `discussion` (FR-004).
- Server-side validation rejects invalid values with 400 Bad Request.
- Category is **immutable** after creation (non-goal: no PATCH category).

---

### 2. PostCategory (constant definition — not a DB table)

A **client-side constant map** defining visual properties per category. Not stored in DB.

```typescript
// app/lib/categories.ts (NEW file)

export interface CategoryDefinition {
  id: PostCategory;
  emoji: string;
  label: string;
  color: string;        // Primary color (speech-bubble background)
  colorLight: string;   // Light variant (ring / highlight)
  tailColor: string;    // Speech-bubble tail color (matches background)
}

export const CATEGORIES: Record<PostCategory, CategoryDefinition> = {
  question: {
    id: "question",
    emoji: "❓",
    label: "Question",
    color: "#60a5fa",        // blue-400
    colorLight: "rgba(96,165,250,0.3)",
    tailColor: "#60a5fa",
  },
  discussion: {
    id: "discussion",
    emoji: "💬",
    label: "Discussion",
    color: "#a78bfa",        // purple-400
    colorLight: "rgba(167,139,250,0.3)",
    tailColor: "#a78bfa",
  },
  share: {
    id: "share",
    emoji: "💡",
    label: "Share",
    color: "#fbbf24",        // amber-400
    colorLight: "rgba(251,191,36,0.3)",
    tailColor: "#fbbf24",
  },
  help: {
    id: "help",
    emoji: "🆘",
    label: "Help",
    color: "#f87171",        // red-400
    colorLight: "rgba(248,113,113,0.3)",
    tailColor: "#f87171",
  },
  meetup: {
    id: "meetup",
    emoji: "☕",
    label: "Meetup",
    color: "#34d399",        // emerald-400
    colorLight: "rgba(52,211,153,0.3)",
    tailColor: "#34d399",
  },
};

export const DEFAULT_CATEGORY: PostCategory = "discussion";

export const CATEGORY_VALUES: PostCategory[] = [
  "question", "discussion", "share", "help", "meetup"
];
```

---

### 3. CreatePostRequest (extended)

```typescript
// app/types/index.ts — request type extension
export interface CreatePostRequest {
  text: string;
  lat: number;
  lng: number;
  tags?: string[];
  ttl: "1m" | "24h" | "72h" | "7d";
  mode?: "online" | "offline" | "both";
  category?: PostCategory;          // NEW — optional, defaults to "discussion"
}
```

---

### 4. ClusterFeature (client-side only — not persisted)

Represents a cluster of posts as produced by Azure Maps DataSource clustering. Exists only in the MapView component's rendering logic.

```typescript
// Inline type in MapView.tsx (or a local types file)
interface ClusterFeatureProperties {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
  // Custom aggregated properties (from DataSource clusterProperties)
  questionCount: number;
  discussionCount: number;
  shareCount: number;
  helpCount: number;
  meetupCount: number;
}

interface PostFeatureProperties {
  cluster: false;
  postId: string;
  category: PostCategory;
  authorName: string;
  text: string;
  createdAt: string;
  expiresAt: string;
  interestedCount: number;
  joinCount: number;
}
```

---

## State Transitions

### Post Category Lifecycle

```
[No category selected] → (default: "discussion") → [Saved with category] → [Immutable]
[User selects category] → [Saved with category] → [Immutable]
```

Category is set once at creation and cannot be changed.

### Cluster State Transitions

```
[Individual pins] → (zoom out / pins overlap) → [Cluster marker with badge]
[Cluster marker] → (zoom in / pins separate) → [Individual pins]
[Cluster marker] → (click) → [Cluster list panel open]
[Cluster list panel] → (select post) → [PostPopup opens]
[Cluster list panel] → (map pan/zoom) → [Panel closes]
[Cluster with 1 post remaining] → (TTL expiry) → [Dissolve to individual pin]
```

---

## Migration Strategy

- **SQLite `ALTER TABLE`**: Add `category` column with `DEFAULT 'discussion'`. This is a non-destructive, backwards-compatible migration.
- **Existing posts**: All existing posts without a `category` value will automatically receive `'discussion'` via the column default (FR-009).
- **No data migration script needed**: The `DEFAULT` clause handles legacy data.
- **DB initialization**: Update `db.ts` to include the `category` column in the `CREATE TABLE` statement and add an `ALTER TABLE` migration for existing databases.

---

## Relationships

```
Post (1) ──── has ──── (1) PostCategory (constant lookup)
Post (N) ──── grouped into ──── (1) Cluster (transient, client-side only)
Cluster (1) ──── contains ──── (N) Post
```

Post → PostCategory is a lookup relationship via the `category` field against the `CATEGORIES` constant map. Clusters are transient client-side groupings managed by Azure Maps DataSource — they have no database representation.
