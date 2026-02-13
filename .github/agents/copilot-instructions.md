# linkup Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-11

## Active Technologies
- TypeScript 5.x, Node.js 18+ + `react-azure-maps`, `azure-maps-control` v3, `next-auth@beta` (Auth.js v5), `better-sqlite3`, `openai`, `@azure/identity`, `@modelcontextprotocol/sdk` v1.26+, `zod` (001-map-first-mvp)
- SQLite via `better-sqlite3` (file-based, zero-config) (001-map-first-mvp)
- TypeScript 5.9, Node.js (Next.js 14 SSR) + `@langchain/langgraph` ^1.1.4, `@langchain/openai` ^1.2.7, `@langchain/core` ^0.3.x (NEW); `@modelcontextprotocol/sdk` ^1.26.0, `openai` ^6.21.0 (EXISTING — `openai` SDK retained for embeddings + fallback) (002-langgraph-migration)
- SQLite via `better-sqlite3` (unchanged); in-memory embedding cache (unchanged) (002-langgraph-migration)

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
- 002-langgraph-migration: Added TypeScript 5.9, Node.js (Next.js 14 SSR) + `@langchain/langgraph` ^1.1.4, `@langchain/openai` ^1.2.7, `@langchain/core` ^0.3.x (NEW); `@modelcontextprotocol/sdk` ^1.26.0, `openai` ^6.21.0 (EXISTING — `openai` SDK retained for embeddings + fallback)
- 001-map-first-mvp: Added TypeScript 5.x, Node.js 18+ + `react-azure-maps`, `azure-maps-control` v3, `next-auth@beta` (Auth.js v5), `better-sqlite3`, `openai`, `@azure/identity`, `@modelcontextprotocol/sdk` v1.26+, `zod`

- 001-map-first-mvp: Added TypeScript 5.x / Node.js 18+

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
