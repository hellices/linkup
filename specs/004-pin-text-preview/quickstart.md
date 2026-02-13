# Quickstart: Pin Text Preview

**Feature**: 004-pin-text-preview  
**Date**: 2026-02-13

---

## Prerequisites

- Node.js 18+ installed
- Azure Maps subscription key in `.env.local` as `NEXT_PUBLIC_AZURE_MAPS_KEY`
- Existing LinkUp dev setup working (`npm run dev`)
- Feature 003 (Pin Category Icons & Clustering) merged — required for speech-bubble pins and clustering

## Setup

```bash
# 1. Switch to feature branch
git checkout 004-pin-text-preview

# 2. Install dependencies (no new npm packages required)
npm install

# 3. Start dev server
npm run dev
```

No new npm dependencies, database migrations, or environment variables are introduced by this feature. All changes are within the existing `MapView.tsx` component.

## Verification Checklist

### 1. Solo Pin Shows Text Snippet

1. Open the app and allow location permission
2. Create a post with text: "Anyone want to grab lunch at the Building 33 cafeteria today?"
3. Ensure the post is not near any other posts (no clustering)

**Expected**: The speech-bubble pin displays the category emoji as before, and below the tail triangle a truncated text snippet appears: "Anyone want to grab lunch at the…" (centered under the pin, small gray text).

### 2. Short Text Shows Without Ellipsis

1. Create a post with very short text: "Hi there"
2. Ensure it's a solo pin

**Expected**: The snippet displays "Hi there" in full — no ellipsis, no truncation.

### 3. Cluster Shows Newest Post Preview

1. Create 3+ posts very close together (click the same area)
2. Zoom out until they merge into a cluster badge

**Expected**: The cluster badge shows the count (e.g., "3") AND below it the newest post's snippet text plus "+2 more" in small gray italic text.

3. Click the cluster marker

**Expected**: The ClusterListPanel opens with the full list sorted newest-first. The first item's text matches the snippet shown on the cluster marker.

4. Zoom back in until posts separate

**Expected**: The cluster preview disappears and each solo pin shows its own individual snippet.

### 4. Search Dimming Hides/Fades Snippet

1. Create several posts with varied text
2. Perform a search that matches some but not all posts
3. Observe the dimmed (non-matching) pins

**Expected**: Dimmed pins either hide their snippet text entirely or show it at the same faded opacity as the pin itself. Matched pins show their snippet at full opacity.

4. Clear the search

**Expected**: All solo pins display their snippets at full opacity again.

### 5. Snippet Click Behavior

1. Click on the snippet text below a solo pin

**Expected**: The PostPopup panel opens for that post — the snippet click behaves identically to clicking the speech bubble itself.

### 6. Nearby Pins — Occlusion Avoidance

1. Create 2 posts that are close together but far enough apart that they don't cluster (e.g., ~100px apart on screen)
2. Make one post older and one post newer

**Expected**: If the snippets would overlap, only the newer post's snippet is shown. The older post's snippet is hidden. The pins themselves (bubbles) are still both visible.

3. Zoom in so the two pins spread further apart

**Expected**: Once there is enough room, both snippets appear.

### 7. Multiple Solo Pins Well Separated

1. Create 2-3 posts that are near each other but far enough apart that they don't cluster (different areas of the campus)

**Expected**: Each pin shows its own snippet. Snippets don't overlap with adjacent pins at reasonable zoom levels.

## Key Files Changed

| File | Change |
|------|--------|
| `app/components/MapView.tsx` | Add `truncateSnippet()` function; modify `buildSpeechBubbleHtml()` to render snippet text below tail; modify `buildClusterHtml()` to render newest-post snippet + "+N more"; add occlusion avoidance pass in `renderMarkers()`; handle snippet dimming in search-highlight branch |
