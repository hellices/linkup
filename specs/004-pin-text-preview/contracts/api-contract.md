# API Contracts: Pin Text Preview

**Feature**: 004-pin-text-preview  
**Date**: 2026-02-13  

## No API Changes

This feature is a **purely client-side rendering enhancement**. No API endpoints are added, modified, or deprecated.

The existing `GET /api/posts` endpoint already returns `PostSummary` objects with the `text` field, which the `MapView` component already receives via props. The snippet truncation and rendering logic is entirely within the browser.

### Existing Endpoints (unchanged)

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/posts` | NONE — already returns `PostSummary.text` |
| `POST` | `/api/posts` | NONE |
| `POST` | `/api/posts/[postId]/engagement` | NONE |
| `GET` | `/api/search` | NONE |
