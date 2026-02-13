# Quickstart: Pin Category Icons & Clustering

**Feature**: 003-pin-category-icons  
**Date**: 2026-02-13

---

## Prerequisites

- Node.js 18+ installed
- Azure Maps subscription key in `.env.local` as `NEXT_PUBLIC_AZURE_MAPS_KEY`
- Existing LinkUp dev setup working (`npm run dev`)

## Setup

```bash
# 1. Switch to feature branch
git checkout 003-pin-category-icons

# 2. Install dependencies (no new npm packages required)
npm install

# 3. Start dev server
npm run dev
```

No new npm dependencies are introduced by this feature. All changes use the existing `azure-maps-control` SDK and built-in CSS.

## Database Migration

The `category` column is added to the `posts` table automatically. On first startup after the code change:

1. `db.ts` runs `CREATE TABLE IF NOT EXISTS` with the updated schema (includes `category`).
2. For existing databases, an `ALTER TABLE` migration adds the `category` column with `DEFAULT 'discussion'`.
3. All existing posts automatically receive `discussion` as their category.

No manual migration step is needed.

## Verification Checklist

### 1. Category Selection in Post Creation

1. Sign in via Entra ID
2. Click anywhere on the map to open the post creation modal
3. Verify 5 category buttons are displayed: ❓ Question, 💬 Discussion, 💡 Share, 🆘 Help, ☕ Meetup
4. Verify 💬 Discussion is pre-selected as the default
5. Select a different category (e.g., ❓ Question)
6. Enter text, select TTL, and save

**Expected**: Post is created with the selected category. The new marker on the map shows a speech-bubble pin with the ❓ emoji and blue color.

### 2. Differentiated Pin Display

1. Create 3 posts with different categories (e.g., Question, Share, Meetup)
2. View the map

**Expected**: Each pin is rendered as a speech-bubble marker with:
- Category-specific emoji (❓, 💡, ☕)
- Category-specific background color (blue, amber, green)
- White border and drop shadow

### 3. Category in Post Popup

1. Click on a post marker on the map
2. View the post popup panel

**Expected**: The category emoji + label (e.g., "❓ Question") appears in the popup near the author info.

### 4. Pin Clustering

1. Create 3+ posts at the same or very close coordinates
2. Zoom out until pins overlap

**Expected**:
- Overlapping pins merge into a cluster marker showing the count (e.g., "3")
- Click the cluster marker → a list panel appears with posts sorted newest first
- Each list item shows category emoji, text preview, author name, time remaining
- Select a post from the list → the PostPopup opens for that post
- Zoom in → cluster dissolves into individual pins

### 5. Search Highlight + Category Coexistence

1. Create several posts with different categories
2. Perform a search using the search bar
3. Verify search-matched pins are highlighted (orange + enlarged) but still show their category emoji
4. Verify non-matching pins are dimmed but still show their category emoji

### 6. Legacy Post Compatibility

1. If testing with an existing database that has posts without the `category` column
2. Verify all existing posts display as 💬 Discussion (default)

## API Testing

```bash
# Create a post with category
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"text": "Need help with AKS.", "lat": 47.674, "lng": -122.1215, "ttl": "24h", "category": "question"}'

# Create a post without category (defaults to "discussion")
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"text": "Check this out!", "lat": 47.674, "lng": -122.1215, "ttl": "24h"}'

# Verify response includes category field
# Expected: "category": "question" or "category": "discussion"
```

Note: These curl commands require authentication. In practice, test via the browser UI with an active session.

## Key Files Changed

| File | Change |
|------|--------|
| `app/types/index.ts` | Add `PostCategory` type, `category` field to `Post`, `CreatePostRequest` |
| `app/lib/categories.ts` | **NEW** — Category definitions (emoji, label, colors) |
| `app/lib/db.ts` | Add `category` column to schema + migration |
| `app/lib/validation.ts` | Add category validation |
| `app/api/posts/route.ts` | Accept + validate `category` in POST, return in GET |
| `app/components/PostCreateModal.tsx` | Add category selector UI |
| `app/components/MapView.tsx` | Speech-bubble pins, DataSource clustering, cluster markers |
| `app/components/ClusterListPanel.tsx` | **NEW** — Cluster post list panel |
| `app/components/PostPopup.tsx` | Display category emoji + label |
