# Quickstart: Post Replies & Document Sharing

**Feature**: `005-post-replies-docs`  
**Date**: 2026-02-13

## Prerequisites

- Node.js 18+ installed
- Git branch `005-post-replies-docs` checked out
- Environment variables configured (`.env.local` with Entra ID, Azure Maps, AI Foundry keys)

## Setup

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Start the dev server
npm run dev

# 3. Open the app
# Navigate to http://localhost:3000
```

No new dependencies are required for this feature.

## Database Migration

The new `replies` and `shared_documents` tables are auto-created on startup via the existing `getDb()` initialization in `app/lib/db.ts`. No manual migration is needed — restarting the dev server is sufficient.

## Verification Steps

### P1 — Text Replies

1. Sign in via the Entra ID button
2. Click any map pin to open the PostPopup
3. Scroll to the "Replies" section below the engagement buttons
4. Type a reply (1–500 characters) and press the send button
5. **Verify**: The reply appears immediately at the top of the list with your name and timestamp
6. **Verify**: The "Sending…" visual clears and the reply is fully opaque
7. Sign out → **Verify**: The reply input shows "Sign in to reply" and is disabled
8. Open an expired post → **Verify**: Reply input is disabled with "Post expired" message

### P2 — M365 Document Sharing

1. Sign in and open a post with MCP Suggestions loaded
2. Find an M365 document in the "M365 Internal Resources" section
3. Click the "Share" button next to a document
4. **Verify**: The document appears in the "Shared Documents" section with your name
5. **Verify**: The Share button changes to "Shared ✓" (disabled)
6. Click the document title → **Verify**: Opens in a new browser tab
7. Try sharing the same document again → **Verify**: Button remains disabled; no duplicate created

### P2 — Section Separation & Pagination

1. Open a post with 6+ replies (use the seed script or create manually)
2. **Verify**: "Replies" section shows 5 items + "Load more" button
3. Click "Load more" → **Verify**: Remaining replies load; button disappears if all loaded
4. **Verify**: "Replies" and "Shared Documents" sections have distinct headers
5. **Verify**: Each section is independently scrollable/paginated

### P3 — Delete Own Reply

1. Sign in and create a reply on any post
2. **Verify**: A delete button (🗑️ or ✕) appears on your own reply
3. Click delete → **Verify**: Confirmation dialog appears
4. Confirm → **Verify**: Reply is removed from the list
5. View someone else's reply → **Verify**: No delete button shown

## Seeding Test Data

To test pagination with many replies, you can use the existing seed script or manually create posts via the UI and add replies. For bulk testing:

```bash
# Create a post via curl, then add replies
# (Replace with actual post ID and auth token)

# Create reply
curl -X POST http://localhost:3000/api/posts/{postId}/replies \
  -H "Content-Type: application/json" \
  -d '{"text": "Test reply content"}'
```

## Type Checking

```bash
npx tsc --noEmit
```
