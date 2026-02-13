# LinkUp — Map-First Knowledge Connection Platform

> **🧠 Agents League @ TechConnect — Reasoning Agents Track (Microsoft Foundry)**

## The Problem

In large organizations, **the knowledge you need already exists** — buried in a colleague's OneDrive, a SharePoint doc, or an old email thread. But when you hit a blocker, you default to posting in Teams and *hoping* someone sees it. There's no spatial, contextual, or intelligent way to connect people with the right internal knowledge at the right time.

## The Solution

**LinkUp** turns knowledge discovery into a **map-based, AI-powered experience**. Drop a 3-sentence question on the map, and a reasoning agent instantly surfaces the most relevant internal resources — your organization's OneDrive files, SharePoint docs, Outlook emails — alongside similar posts from other users, then suggests a concrete next action.

The agent doesn't just search — it **reasons**. It expands your question into multiple diverse queries, autonomously decides which tools to call via MCP, deduplicates across sources, and synthesizes a one-line action hint. All in under 5 seconds.

### Why Map-First?

Knowledge problems are often **location-aware**. "Who's worked on this in my building?" "What resources exist for this office?" A map-first UI makes collaboration *spatial* and *intuitive* — see where help is needed, see who's nearby, and jump in.

---

## Demo

<!-- TODO: Add demo video or screenshots -->
> 📹 *Demo video / screenshots to be added*

### Demo Flow (2 minutes)

| Step | Action | What You See |
|------|--------|--------------|
| 1 | **Sign in** with Entra ID | Full-screen map loads centered on your location |
| 2 | **Create a post** via "+" button | Write 3 sentences + pick category + set TTL → pin appears on map |
| 3 | **Click the pin** | Popup shows post + **"Suggested via MCP"** panel |
| | | 💡 **Action Hint** — *"Check the onboarding guide in SharePoint first"* |
| | | 📁 **M365 Results** — OneDrive / SharePoint / Email matches |
| | | 📌 **Similar Posts** — from other users (semantic match) |
| 4 | **Search** via search bar | AI-matched pins highlighted on map, others dimmed |
| 5 | **Click "Join"** | Collaboration count updates instantly |
| 6 | **Wait for TTL** | Post expires → pin auto-disappears from the map |

---

## How the Agent Reasons

LinkUp's reasoning agent uses a **LangGraph StateGraph** with multi-step orchestration:

```
User's 3-sentence post
        │
        ▼
┌─ LLM (GPT-4o-mini) ─────────────────────────────┐
│                                                   │
│  1. Multi-Query Expansion                         │
│     Generate 2–3 diverse search queries           │
│     (original keywords + synonyms + broader terms)│
│                                                   │
│  2. Tool Discovery & Selection (MCP)              │
│     Discover tools via listTools()                │
│     Autonomously decide which to call             │
│     (no hardcoded tool routing)                   │
│                                                   │
│  3. Execute & Observe (ReAct-style loop)          │
│     search_m365  → Graph API → OneDrive/SP/Mail   │
│     search_posts → Embedding cosine similarity    │
│     (may call same tool with different queries)   │
│                                                   │
│  4. Deduplicate & Synthesize                      │
│     Merge results across sources by URL/title     │
│     Generate 1-line Action Hint                   │
│     Return structured categorized response        │
└───────────────────────────────────────────────────┘
```

**Reasoning patterns used:**

| Pattern | How It's Applied |
|---------|-----------------|
| **Multi-Query Expansion** | LLM generates 2–3 semantically diverse queries from the post text to maximize recall |
| **LLM-Driven Tool Selection** | Agent discovers MCP tools at runtime via `listTools()` — new tools are picked up automatically without code changes |
| **ReAct-style Loop** | LangGraph `StateGraph` with conditional edges: `llmCall → toolExec ↔ llmCall → formatResponse` |
| **Cross-Source Deduplication** | Results from M365 and posts are merged by URL/title before synthesis |
| **Graceful Degradation** | LLM failure → hardcoded fallback; partial source failure → show only successful sources |

---

## Architecture

```
Next.js 14 (:3000) — Single Process, No Sidecar
┌─────────────────────────────────────────────────┐
│  React UI         Azure Maps + Entra ID SSO     │
│      │                                          │
│  API Routes       /posts  /search  /suggestions │
│      │                                          │
│  LangGraph Agent  StateGraph (multi-step)       │
│      │                                          │
│  MCP Client ←── InMemoryTransport ──→ MCP Server│
│                                                 │
│  MCP Tools:                                     │
│   ├─ search_m365       Graph API (OneDrive/SP/  │
│   │                    Mail) — PRIMARY source    │
│   ├─ search_posts      Embedding cache + cosine │
│   └─ gen_action_hint   GPT-4o-mini chat         │
│                                                 │
│  AI Foundry:  text-embedding-3-small            │
│               + gpt-4o-mini                     │
│  Storage:     SQLite (better-sqlite3)           │
└─────────────────────────────────────────────────┘
```

The MCP server runs **in-process** via `InMemoryTransport` — no sidecar, no HTTP overhead. Tools directly access the app's embedding cache and database.

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Map-First UI** | Full-screen Azure Maps with category-colored speech-bubble pins (❓💬💡🆘☕) |
| ✍️ **3-Sentence Posts** | Ultra-lightweight — sentence validation excludes URLs/ellipsis; mandatory TTL |
| 🤖 **MCP Reasoning Agent** | LangGraph StateGraph with Multi-Query Expansion + LLM-driven tool selection |
| 📁 **M365 Integration** | Primary source — searches OneDrive, SharePoint, Outlook via Microsoft Graph API |
| 🔍 **Semantic Search** | `text-embedding-3-small` embeddings → cosine similarity → map bbox re-filtering |
| 💡 **Action Hint** | AI-generated one-line next step based on search results |
| 🤝 **Collaboration** | Interested / Join participation with idempotent handling |
| ⏳ **Ephemeral Posts** | TTL-based auto-expiration (24h / 72h / 7d) |
| 🏷️ **Category Pins** | 5 types: Question, Discussion, Share, Help, Meetup — distinct emoji + color |
| 📍 **Pin Clustering** | Overlapping pins merge into clusters with count badges |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| Frontend | React 18, Azure Maps SDK, Tailwind CSS |
| Auth | Auth.js v5 + Microsoft Entra ID |
| AI / LLM | Azure AI Foundry (GPT-4o-mini, text-embedding-3-small) |
| Agent | LangGraph (`@langchain/langgraph`) StateGraph |
| Tool Protocol | Model Context Protocol (MCP) — in-process via `InMemoryTransport` |
| M365 Search | Microsoft Graph Search API (OneDrive, SharePoint, Outlook) |
| Database | SQLite (better-sqlite3) |
| Dev Tooling | GitHub Copilot (Claude Opus 4.6) — spec-driven development |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Azure subscription (Azure Maps + Azure OpenAI)
- Entra ID app registration (with M365 API permissions)

### Setup

```bash
git clone <repo-url> && cd linkup
npm install
```

Create `.env.local`:

```env
# Auth.js
AUTH_SECRET=<generate with: npx auth secret>
AUTH_MICROSOFT_ENTRA_ID_ID=<Entra App Client ID>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<Entra App Client Secret>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<TENANT_ID>/v2.0

# Azure Maps
NEXT_PUBLIC_AZURE_MAPS_KEY=<Azure Maps Subscription Key>

# AI Foundry (Azure OpenAI)
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<API Key>
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
```

> ⚠️ **No credentials are committed.** All secrets are loaded from `.env.local` (in `.gitignore`).

```bash
npm run dev
# → http://localhost:3000
# MCP server runs in-process — no separate terminal needed
```

See [quickstart guide](specs/001-map-first-mvp/quickstart.md) for detailed Azure & Entra ID setup.

---

## Project Structure

```
app/
├── components/           # MapView, PostPopup, SearchBar, ClusterListPanel, etc.
├── api/                  # Next.js API routes (posts, search, suggestions)
├── lib/
│   ├── agents/           # LangGraph reasoning agent
│   │   └── suggestions/  #   StateGraph: prompt, tools, graph, fallback
│   ├── mcp/              # MCP server + tools (search_m365, search_posts, action_hint)
│   ├── ai-foundry.ts     # AI Foundry client (embeddings + chat)
│   ├── categories.ts     # Pin category definitions (emoji, color, label)
│   └── db.ts             # SQLite schema + queries
specs/                    # Feature specifications + implementation plans
docs/                     # Architecture docs + Copilot usage notes
```

## Documentation

- [Full Specification](specs/001-map-first-mvp/spec.md) — User stories, acceptance criteria, edge cases
- [MCP Architecture](docs/mcp.md) — In-process MCP design, tool orchestration flow
- [LangGraph Migration](specs/002-langgraph-migration/spec.md) — Agent architecture decisions
- [Pin Categories & Clustering](specs/003-pin-category-icons/spec.md) — Visual differentiation design
- [GitHub Copilot Usage](docs/copilot-notes.md) — AI-assisted development process
- [OpenAPI Contract](specs/001-map-first-mvp/contracts/openapi.yaml)
