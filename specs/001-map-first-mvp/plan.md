# Implementation Plan: LinkUp Map-First MVP + AI Foundry Semantic Search + MCP Integration

**Branch**: `001-map-first-mvp` | **Date**: 2026-02-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-map-first-mvp/spec.md`

## Summary

LinkUp is an MVP of a map-centric ultra-lightweight app where Entra ID-authenticated users post up to 3-sentence messages on a map, receive recommendations for **M365 internal resources (OneDrive files/PPT, SharePoint documents, Outlook emails) as primary**, and supplementarily similar posts/docs/issues via AI Foundry-based semantic search, get multi-source combined search (M365 + Docs + Issues) + Action Hints through MCP, and initiate collaboration via Interested/Join. The End-to-End implementation must be completed within 100 minutes, and the entire flow must be demonstrable in a 2-minute demo.

**Core Technical Approach**:
- Next.js 14 App Router + TypeScript single project
- Map rendering with `azure-maps-control` + `react-azure-maps`
- Authentication with Auth.js v5 (NextAuth beta) + Entra ID provider
- Lightweight persistent storage with `better-sqlite3`
- AI Foundry (embeddings + chat) integration with `openai` (AzureOpenAI) + `@azure/identity`
- MCP server integration with `@modelcontextprotocol/sdk` (Docs + Issues + Posts combined)

## Objective

Complete the following End-to-End experience within 100 minutes:

- Entra login
- Azure Maps map display
- 3-sentence post creation (TTL)
- Display posts as markers on the map
- AI Foundry-based related recommendations when creating a post (at least 2 of Posts + Docs + Issues)
- AI Foundry semantic search when searching on the map → re-filter and display within the map viewport
- Multi-source combination via MCP (Suggested via MCP + Action Hint)
- Interested/Join
- TTL expiration exclusion handling

The entire flow must be demonstrable in a 2-minute demo.

## Timebox Strategy (100 minutes)

- **Increase AI Foundry implementation weight** → reduce UI/auxiliary features instead
- **MCP queries: M365 internal resources (OneDrive/SharePoint/Email) as primary, web resources (Docs/Issues) as supplementary**
- **Action Hint generation**: MCP server directly calls GPT-4o-mini to generate. Falls back to template when AI Foundry is unavailable.
- **Map-search re-filtering uses semantic results + bbox filtering**
- Score/ranking/dashboard features are excluded from this Plan

## Architecture Decision: MCP In-Process Integration

**Decision**: Integrate the MCP server into the Next.js app to run in a single process (InMemoryTransport).

**Rationale**:
- No separate sidecar process needed — MCP's value lies in the pattern of "exposing tools via protocol and having the LLM dynamically discover/select them," regardless of whether it's a separate process
- `search_posts` can directly access the app's PostEmbedding cache — eliminates HTTP callback
- Single AI Foundry client — unified in `app/lib/ai-foundry.ts` without duplicate code
- Reduced operational complexity — single process, single deployment, no port conflicts
- Eliminates sidecar pattern bug sources such as per-request transport creation

**Architecture**:
```
Next.js App (:3000)
├── app/lib/mcp/server.ts       ← McpServer singleton + tool registration
├── app/lib/mcp/tools/
│   ├── search-m365.ts          ← query → M365 unified search (OneDrive/SharePoint/Email) — PRIMARY
│   ├── search-docs.ts          ← query → embed via app's ai-foundry → cosine vs pre-embedded docs — supplementary
│   ├── search-issues.ts        ← query → embed via app's ai-foundry → cosine vs pre-embedded issues — supplementary
│   ├── search-posts.ts         ← query → direct PostEmbedding cache access (no HTTP needed!)
│   └── action-hint.ts          ← searchResults → GPT-4o-mini via app's ai-foundry → 1-line hint
├── app/lib/mcp/data/
│   ├── sample-m365.json        ← M365 unified sample data (OneDrive/SharePoint/Email)
│   ├── sample-docs.json
│   └── sample-issues.json
├── app/lib/mcp-client.ts       ← In-process connection via InMemoryTransport
└── app/lib/ai-foundry.ts       ← Single AI Foundry client (embeddings + chat)
```

**Fallback Strategy**:
- When AI Foundry is unavailable: `search_docs`/`search_issues` return all data, `action_hint` uses template-based generation
- When PostEmbedding cache is empty: `search_posts` returns an empty array

**Rejected Alternative (separate sidecar process)**:
- Separating the MCP server into a separate process (:3001) requires HTTP callback for `search_posts`
- Potential for per-request McpServer instance management bugs
- Duplicate environment variables, dual deployment management, port management overhead

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+
**Framework**: Next.js 14+ (App Router)
**Primary Dependencies**: `react-azure-maps`, `azure-maps-control` v3, `next-auth@beta` (Auth.js v5), `better-sqlite3`, `openai`, `@azure/identity`, `@modelcontextprotocol/sdk` v1.26+, `zod`
**Storage**: SQLite via `better-sqlite3` (file-based, zero-config)
**Testing**: Vitest (unit); integration tests deferred to post-MVP
**Target Platform**: Web (localhost:3000 for MVP)
**Project Type**: Web application (single Next.js project, MCP server in-process)
**Performance Goals**: Post creation within 30 seconds, MCP recommendation results within 5 seconds, semantic search within 3 seconds
**Constraints**: 100-minute build timebox, 2-minute demo capability, AI Foundry call timeout 5 seconds
**Scale/Scope**: MVP single-user demo, small dataset (in-memory vector comparison)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| 1.1 Lightweight by Design | ✅ PASS | 3-sentence limit maintained, minimal UI, can ask a question within 10 seconds |
| 1.2 Map-First Interaction | ✅ PASS | Uses Azure Maps Web SDK, map-centric UI |
| 1.3 Connection Over Storage | ✅ PASS | Interested/Join → connects to next action, provides MCP Action Hint |
| 2.1 Mandatory TTL | ✅ PASS | TTL required for all posts, excluded from queries upon expiration |
| 2.2 Optional De-identified Summary | ✅ PASS | Data deleted after expiration in MVP (no summary retention) |
| 3.1 Entra ID Auth Only | ✅ PASS | Uses Auth.js + Entra ID provider |
| 3.2 Minimum-Privilege | ✅ PASS | Maps: subscription key, Entra: minimum scope |
| 3.3 Zero Sensitive Data | ✅ PASS | Log masking, no PII storage, FR-019 compliant |
| 4.1 MCP as Core Capability | ✅ PASS | Resource recommendation via MCP server is a required path |
| 4.2 Multi-source Knowledge | ✅ PASS | M365 internal resources (OneDrive/SharePoint/Email) + web resources (Docs/Issues) + Posts unified search |
| 4.3 Transparency | ✅ PASS | "Suggested via MCP" label displayed in UI |
| 5.1 Intent-based Participation | ✅ PASS | Interested/Join 2 stages (Available is post-MVP) |
| 5.2 No Heavy Social Graph | ✅ PASS | No friends/follow functionality |
| 6.x Rewards & Reputation | ⏭ SKIP | Outside MVP scope (Score/Dashboard in Cut List) |
| 7.1 Modular Architecture | ✅ PASS | UI/API/DB/MCP/AI Foundry layer separation |
| 7.2 Observability | ⚠️ PARTIAL | MVP at console.log level, structured logging is post-MVP |
| 8.1 Spec-Driven Flow | ✅ PASS | Follows spec → plan → tasks → implement order |
| 8.3 MVP First | ✅ PASS | 100-minute timebox, 2-minute demo priority |
| 9.x Non-Negotiable | ✅ PASS | No GPS tracking/ads/permanent bulletin boards/sensitive data |

**GATE RESULT: ✅ PASS** — No violations. 7.2 Observability is intentionally minimized within MVP scope (justification: 100-minute timebox).

## Milestones & Timeline

### M0 (0–10m): Baseline Setup
- Next.js initialization (`create-next-app` + TypeScript + App Router)
- Environment variable setup (Azure Maps key, Entra config, MCP endpoints, AI Foundry endpoint)
- Basic layout + map area placeholder
- `better-sqlite3` DB initialization (posts, engagements tables)

### M1 (10–22m): Entra ID Auth (Login Gate)
- Auth.js v5 + `microsoft-entra-id` provider configuration
- Login/logout UI (SignIn/SignOut buttons)
- Non-authenticated users cannot create posts or participate (middleware protection)
- Connect Auth context first

### M2 (22–38m): Azure Maps Map Rendering + Sample Markers
- `react-azure-maps` component integration (`'use client'` + `next/dynamic`)
- Initial map render (default coordinates: Redmond, WA) + click event handling
- Sample marker/popup display
- CSS import (`azure-maps-control/dist/atlas.min.css`)

### M3 (38–58m): Post Creation (3 Sentences + TTL)
- Post model/API implementation (`POST /api/posts`, `GET /api/posts`)
- 3-sentence limit (front-end + back-end validation, URL dots/ellipsis excluded)
- TTL storage → expiration exclusion GET filter (`WHERE expiresAt > datetime('now')`)
- Determine (lat, lng) via map click
- Render map marker after post creation

### M4 (58–75m): AI Foundry Semantic Search Feature Configuration (Core)
- Initialize `AzureOpenAI` client with the `openai` package
- Call AI Foundry vector endpoint (`text-embedding-3-small` embeddings)
- Post text → generate embedding vector → cosine similarity comparison
- Finalize semantic result return structure (`{ docs: [], issues: [], posts: [] }`)
- Unify "related post recommendations" data shape
- Map search: semantic results → re-filter by current map bbox then render markers
- Fallback: return hardcoded results when AI Foundry is unresponsive

### M5 (75–88m): MCP Multi-Source Integration (M365 Primary + Web Supplementary)
- Integrate MCP server as an internal app module (`app/lib/mcp/server.ts`), connect via `InMemoryTransport`
- **LLM-driven MCP tool orchestration** (FR-023):
  1. `mcp-client.ts` connects to in-process McpServer via `InMemoryTransport` → discovers tools via `listTools()`
  2. Converts MCP tool schemas to OpenAI function-calling format
  3. Sends user query + tool definitions to GPT-4o-mini
  4. LLM decides which tools to call (0 or more)
  5. Executes via MCP `callTool()` → passes results back to LLM
  6. LLM generates final response (categorized results + Action Hint)
- Available MCP tools (directly accessible within the app):
  - **PRIMARY (M365 internal resources)**:
    - `search_m365`: query → M365 unified search (OneDrive/SharePoint/Email) → top 1–5
  - **SUPPLEMENTARY (web resources)**:
    - `search_docs`: query → embed via app's ai-foundry → cosine vs pre-embedded docs → top 1–3
    - `search_issues`: query → embed via app's ai-foundry → cosine vs pre-embedded issues → top 0–2
  - `search_posts`: query → direct PostEmbedding cache access → cosine → top 0–5 (no HTTP callback needed)
  - `generate_action_hint`: searchResults → GPT-4o-mini via app's ai-foundry → 1-line hint
- LLM-driven approach means the app does not hardcode — LLM selects tools appropriate for the query
- Graceful degrade: total LLM/MCP failure → "No suggestions available", partial failure → display only successful sources
- Fallback when AI Foundry is unavailable: operates with hardcoded tool call sequence (existing pattern)

### M6 (88–100m): Engagement + Demo Polish
- Interested/Join API (`POST /api/posts/{postId}/engagement`, idempotent upsert)
- Participant count UI update (interestedCount, joinCount)
- Map-search UI (search bar + minimize filter buttons)
- Describe MCP + AI Foundry integration flow in README
- Perform one demo rehearsal

## Scope Control (Cut List)

- Skill tag/category auto-classification
- Post heatmap/dashboard
- Advanced filter UI (date slider, advanced tag selection)
- Score/ranking/reputation system
- Available participation stage (only Interested/Join included in MVP)
- Structured logging/monitoring (console.log level only)
- Real-time WebSocket updates

## Deliverables

- Map-centric interface after Entra login
- Post creation (3 sentences + TTL) → reflected as map markers
- AI Foundry semantic search-based:
  - Similar post recommendations
  - Map search (display only search results as markers)
- MCP multi-source combination: **M365 internal resources as Primary** (OneDrive/SharePoint/Email) + web resources (Docs/Issues) supplementary + Action Hint
- Interested/Join
- Expiration exclusion
- 2-minute demo capability

## Project Structure

### Documentation (this feature)

```text
specs/001-map-first-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output — R1~R7 technical research
├── data-model.md        # Phase 1 output — Post, Engagement, MCP result schema
├── quickstart.md        # Phase 1 output — environment setup & demo script
├── contracts/           # Phase 1 output — OpenAPI 3.1 spec
│   └── openapi.yaml
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
app/
├── layout.tsx            # Root layout (Auth provider, CSS imports)
├── page.tsx              # Main map page
├── api/
│   ├── auth/[...nextauth]/
│   │   └── route.ts      # Auth.js route handler
│   ├── posts/
│   │   └── route.ts      # GET (list) + POST (create) posts
│   ├── posts/[postId]/
│   │   ├── engagement/
│   │   │   └── route.ts  # POST engagement (upsert)
│   │   └── suggestions/
│   │       └── route.ts  # GET MCP+AI suggestions
│   └── search/
│       └── route.ts      # GET semantic map search
├── components/
│   ├── MapView.tsx        # Azure Maps wrapper (client component)
│   ├── PostMarker.tsx     # Map marker for posts
│   ├── PostPopup.tsx      # Popup with post details + MCP suggestions
│   ├── PostCreateModal.tsx # Post creation form (3-sentence + TTL)
│   ├── SearchBar.tsx      # Map search input
│   ├── SuggestionsPanel.tsx # "Suggested via MCP" UI
│   └── AuthButton.tsx     # Sign in / Sign out
├── lib/
│   ├── db.ts              # better-sqlite3 initialization
│   ├── auth.ts            # Auth.js config
│   ├── validation.ts      # 3-sentence validator (shared)
│   ├── mcp-client.ts      # MCP client (InMemoryTransport, in-process)
│   ├── ai-foundry.ts      # Azure OpenAI embeddings + chat (single client)
│   ├── cosine.ts          # Cosine similarity utility
│   └── mcp/               # MCP server module (in-process)
│       ├── server.ts      # McpServer singleton + tool registration
│       ├── tools/
│       ├── search-m365.ts   # M365 unified search (OneDrive/SharePoint/Email) (PRIMARY)
│       │   ├── search-docs.ts     # Web docs search (supplementary)
│       │   ├── search-issues.ts   # GitHub issues search (supplementary)
│       │   ├── search-posts.ts    # direct PostEmbedding cache access
│       │   └── action-hint.ts
│       └── data/
│           ├── sample-m365.json        # M365 unified sample data (OneDrive/SharePoint/Email)
│           ├── sample-docs.json
│           └── sample-issues.json
└── types/
    └── index.ts           # Shared TypeScript types

tests/
└── unit/
    ├── validation.test.ts # 3-sentence validation tests
    └── cosine.test.ts     # Cosine similarity tests
```

**Structure Decision**: Next.js App Router single project, MCP server in-process architecture.
Front-end/back-end/MCP server all run within the same Next.js process.
Connected via InMemoryTransport for MCP client-server communication, no separate process/port needed.
This structure provides minimal complexity optimized for the 100-minute timebox.

## Complexity Tracking

> Only partial compliance with the 7.2 Observability principle is justified in this section.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 7.2 Observability (PARTIAL) | Cannot implement structured logging within the 100-minute timebox | console.log provides sufficient debugging, pino/winston planned for post-MVP |
