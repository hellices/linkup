# linkup Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-11

## Active Technologies
- TypeScript 5.x, Node.js 18+ + `react-azure-maps`, `azure-maps-control` v3, `next-auth@beta` (Auth.js v5), `better-sqlite3`, `openai`, `@azure/identity`, `@modelcontextprotocol/sdk` v1.26+, `zod` (001-map-first-mvp)
- SQLite via `better-sqlite3` (file-based, zero-config) (001-map-first-mvp)
- TypeScript 5.9, Node.js (Next.js 14 SSR) + `@langchain/langgraph` ^1.1.4, `@langchain/openai` ^1.2.7, `@langchain/core` ^1.1.24 (NEW); `@modelcontextprotocol/sdk` ^1.26.0, `openai` ^6.21.0 (EXISTING — `openai` SDK retained for embeddings + fallback) (002-langgraph-migration)
- SQLite via `better-sqlite3` (unchanged); in-memory embedding cache (unchanged) (002-langgraph-migration)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (003-pin-category-icons)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (003-pin-category-icons)
- TypeScript 5.9, Node.js (Next.js 14 SSR) + `azure-maps-control` ^3.7.2 (existing — speech-bubble HtmlMarkers + DataSource clustering), `react` ^18.3.1, `next` ^14.2.35, `better-sqlite3` ^12.6.2, `zod` ^4.3.6 (003-pin-category-icons)
- SQLite via `better-sqlite3` — `category TEXT` column added to `posts` table (003-pin-category-icons)

- TypeScript 5.x / Node.js 18+ (001-map-first-mvp)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x / Node.js 18+: Follow standard conventions

## Recent Changes
- 003-pin-category-icons: Added TypeScript 5.9, Node.js (Next.js 14 SSR) + `azure-maps-control` ^3.7.2 (existing — speech-bubble HtmlMarkers + DataSource clustering), `react` ^18.3.1, `next` ^14.2.35, `better-sqlite3` ^12.6.2, `zod` ^4.3.6
- 003-pin-category-icons: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
- 002-langgraph-migration: Added TypeScript 5.9, Node.js (Next.js 14 SSR) + `@langchain/langgraph` ^1.1.4, `@langchain/openai` ^1.2.7, `@langchain/core` ^1.1.24 (NEW); `@modelcontextprotocol/sdk` ^1.26.0, `openai` ^6.21.0 (EXISTING — `openai` SDK retained for embeddings + fallback)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
