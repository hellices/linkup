# Implementation Plan: Post Replies & Document Sharing

**Branch**: `005-post-replies-docs` | **Date**: 2026-02-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-post-replies-docs/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add text replies and M365 document link sharing to the PostPopup. Currently the only interaction with a post is Interested / Join buttons. This feature adds two new persisted entities (`replies` and `shared_documents` tables in SQLite) and two new API endpoints (replies CRUD, shared-document creation) under `/api/posts/[postId]/`. The PostPopup UI gains two visually separated sections — "Replies" and "Shared Documents" — with cursor-based "Load more" pagination (5 items per batch). Authenticated users can create text replies (max 500 chars) on non-expired posts and share M365 documents from the existing MCP Suggestions panel. Reply authors can delete their own replies.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js (Next.js 14 SSR)
**Primary Dependencies**: `next` ^14.2.35, `react` ^18.3.1, `better-sqlite3` ^12.6.2, `next-auth` ^5.0.0-beta.30, `zod` ^4.3.6, `uuid` ^13.0.0
**Storage**: SQLite (better-sqlite3) — two new tables: `replies`, `shared_documents`
**Testing**: Manual E2E via `npm run dev`; `npx tsc --noEmit` for type-checking
**Target Platform**: Next.js 14 client-side + API routes, Windows dev / Linux deploy
**Project Type**: Web (Next.js monolith)
**Performance Goals**: Reply submission → visible in list within 3 seconds; popup loads initial batch of 5 items in < 2 seconds even with 50+ total replies
**Constraints**: No new npm dependencies; reply text max 500 chars; pagination batches of 5; replies cannot be created on expired posts; duplicate document URL sharing prevented per post; all output in English (Constitution 8.4)
**Scale/Scope**: ~3 new files (2 API routes, 1 component), ~2 modified files (PostPopup, SuggestionsPanel, types, db), ~200–300 lines added; 2 new DB tables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| 1.1 | Lightweight by Design | PASS | Replies are simple text input (no rich editor/forms); sharing a document is a single button click on an existing MCP suggestion |
| 1.2 | Map-First Interaction | PASS | Feature lives within the existing PostPopup — map remains the primary UI |
| 1.3 | Connection Over Storage | PASS | Replies and shared docs directly enable connection between users; documents link to external M365 resources (not stored locally) |
| 2.1 | Mandatory TTL | PASS | Replies and shared documents inherit the post's TTL — when the post is deleted on expiry (CASCADE), all associated replies and documents are automatically deleted |
| 2.2 | Optional De-identified Summary | PASS | No summary retention; all data deleted with post |
| 3.1 | Entra ID Authentication Only | PASS | Reply creation and document sharing require authenticated session (existing NextAuth + Entra ID) |
| 3.2 | Minimum-Privilege Principle | PASS | No new API scopes or permissions; M365 documents come from existing MCP search results |
| 3.3 | Zero Sensitive Data | PASS | Replies are user-generated text; shared document URLs point to M365 (no sensitive data stored) |
| 4.1 | MCP as a Core Capability | PASS | Document sharing leverages existing MCP Suggestions as the source |
| 4.2 | Multi-source Knowledge Access | PASS | Shared documents make MCP's multi-source results collaborative |
| 4.3 | Transparency | PASS | Shared documents retain M365 source type label (OneDrive/SharePoint/Email) |
| 5.1 | Intent-based Participation | PASS | Replies add a communication layer alongside existing Interested/Join — does not replace intent-based participation |
| 5.2 | No Heavy Social Graph | PASS | No followers, friends, or community features; replies are flat (no threads) |
| 6.1–6.4 | Rewards & Reputation | PASS | N/A — no reward mechanics in this feature |
| 7.1 | Modular Architecture | PASS | New API routes in separate files; new UI component separated from PostPopup; DB tables added via migration in existing db.ts |
| 7.2 | Observability | PASS | API errors return structured JSON; no raw user input in logs |
| 8.1 | Spec-Driven Flow | PASS | Following spec → plan → tasks flow |
| 8.2 | Copilot Usage Documentation | PASS | Will document in copilot-notes.md |
| 8.3 | MVP First | PASS | P1 (replies) is a complete MVP slice; P2 (document sharing) and P3 (delete) are incremental |
| 8.4 | English-Only Policy | PASS | All artifacts in English |

**Gate Result**: ALL PASS — no violations. Proceeding to Phase 0.

**Post-Design Re-check (Phase 1)**: ALL PASS — no new violations introduced. TTL policy (2.1) confirmed: `replies` and `shared_documents` tables use `FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE` — data is automatically removed when the post expires and is deleted by the startup sweep. Modular Architecture (7.1) confirmed: separate API route files, dedicated `RepliesDocumentsPanel` component, types extended in existing `types/index.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/005-post-replies-docs/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── openapi.yaml     # New endpoints: replies CRUD, shared documents
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── api/
│   └── posts/
│       └── [postId]/
│           ├── replies/
│           │   └── route.ts         # NEW: GET (paginated list) + POST (create reply)
│           ├── replies/[replyId]/
│           │   └── route.ts         # NEW: DELETE (delete own reply)
│           └── shared-documents/
│               └── route.ts         # NEW: GET (paginated list) + POST (share document)
├── components/
│   ├── PostPopup.tsx                # MODIFIED: Add RepliesDocumentsPanel with section tabs
│   ├── SuggestionsPanel.tsx         # MODIFIED: Add "Share" button next to M365 items
│   └── RepliesDocumentsPanel.tsx    # NEW: Tabbed panel with Replies + Shared Documents sections, "Load more" pagination
├── lib/
│   └── db.ts                        # MODIFIED: Add replies + shared_documents table creation + migration
└── types/
    └── index.ts                     # MODIFIED: Add Reply, SharedDocument, paginated response types
```

**Structure Decision**: Next.js monolith (web). New API routes follow the existing `[postId]/` nesting pattern. A dedicated `RepliesDocumentsPanel` component handles both sections to keep `PostPopup` focused on post details and engagement. DB migrations are added to the existing `getDb()` initialization.

## Complexity Tracking

No constitution violations to justify.
