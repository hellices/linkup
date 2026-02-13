# LinkUp — Map-First Knowledge Connection Platform

> **🧠 Agents League @ TechConnect — Reasoning Agents Track (Microsoft Foundry)**

## The Problem

Organizations lose **an estimated 20% of productive time** to knowledge silos. The answer you need already exists — in a colleague's OneDrive, a SharePoint doc, or an email thread — but there's no intelligent way to surface it. Employees default to posting in Teams and *hoping* someone sees it, creating duplicate work and delayed decisions.

## The Solution

**LinkUp** eliminates knowledge discovery friction with a **map-based, AI-powered experience**.

1. **Drop a question on the map** — write 3 sentences describing your blocker
2. **Get instant AI-curated answers** — a reasoning agent surfaces OneDrive files, SharePoint docs, Outlook emails, and similar posts from colleagues
3. **Act immediately** — receive a concrete, one-line action hint synthesized from all results

**Result**: Questions that took hours of Slack/Teams ping-pong are resolved in **under 5 seconds**.

### Why Map-First?

Knowledge problems are often **location-aware**. "Who in my building has worked on this?" "What resources exist for this office?" A spatial UI makes internal collaboration intuitive — see where help is needed, who's nearby, and jump in.

---

## Business Impact

| Metric | Impact |
|--------|--------|
| ⏱️ **Time to Answer** | Hours → seconds — AI agent surfaces relevant docs instantly |
| 🔄 **Duplicate Work Reduction** | Semantic matching connects people solving the same problem |
| 📈 **M365 ROI** | Unlocks existing OneDrive/SharePoint/Outlook content that goes undiscovered |
| 🌍 **Location-Aware Collaboration** | Connects nearby employees for faster in-person follow-up |
| 🧹 **Information Hygiene** | Ephemeral posts auto-expire (24h–7d), keeping the map fresh |

---

## Demo

<!-- TODO: Add demo video or screenshots -->
> 📹 *Demo video / screenshots to be added*

| Step | Action | What Happens |
|------|--------|-------------|
| 1 | **Sign in** with Entra ID | Map loads centered on your location |
| 2 | **Create a post** | 3 sentences + category + TTL → pin appears on map |
| 3 | **Click any pin** | AI panel shows: 💡 Action Hint, 📁 M365 Results, 📌 Similar Posts |
| 4 | **Search** | AI-matched pins highlighted, others dimmed |
| 5 | **Join** | Collaborate on shared problems in real time |

---

## How It Works

```
User drops a 3-sentence question on the map
                    │
                    ▼
        ┌── Reasoning Agent (GPT-4o-mini) ──┐
        │                                    │
        │  1. Expand → 2–3 diverse queries   │
        │  2. Discover & call MCP tools      │
        │  3. Search M365 + similar posts    │
        │  4. Deduplicate & synthesize       │
        │  5. Return action hint + sources   │
        └────────────────────────────────────┘
                    │
                    ▼
        User sees curated results in < 5 seconds
```

The agent uses **LangGraph** for multi-step reasoning with **MCP (Model Context Protocol)** for dynamic tool discovery — new data sources are picked up automatically without code changes.

---

## Key Features

| Feature | Value |
|---------|-------|
| 🗺️ **Map-First UI** | Spatial knowledge discovery — see problems and expertise geographically |
| 🤖 **Reasoning Agent** | Multi-query expansion + autonomous tool selection via MCP |
| 📁 **M365 Integration** | Searches OneDrive, SharePoint, Outlook via Microsoft Graph API |
| 🔍 **Semantic Search** | AI-powered matching beyond keywords — understands intent |
| 💡 **Action Hint** | One-line AI recommendation — "Check the onboarding guide in SharePoint first" |
| 🤝 **Collaboration** | Join posts to connect with others working on the same problem |
| ⏳ **Ephemeral Posts** | Auto-expire after 24h / 72h / 7d — no stale content |
| 🏷️ **Category Pins** | Question, Discussion, Share, Help, Meetup — visual triage at a glance |

---

## Architecture

```
Next.js 14 — Single Process
┌───────────────────────────────────────────┐
│  React UI        Azure Maps + Entra SSO   │
│  API Routes      /posts /search /suggest  │
│  LangGraph Agent ←→ MCP Server (in-proc)  │
│  MCP Tools:  search_m365 | search_posts   │
│              generate_action_hint         │
│  AI: GPT-4o-mini + text-embedding-3-small │
│  DB: SQLite                               │
└───────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14, TypeScript |
| Frontend | React 18, Azure Maps SDK, Tailwind CSS |
| Auth | Auth.js v5 + Microsoft Entra ID |
| AI | Azure AI Foundry (GPT-4o-mini, text-embedding-3-small) |
| Agent | LangGraph StateGraph + MCP (in-process) |
| M365 | Microsoft Graph Search API |
| Database | SQLite |

---

## Quick Start

```bash
git clone <repo-url> && cd linkup
npm install
```

Create `.env.local` — see [quickstart guide](specs/001-map-first-mvp/quickstart.md) for detailed setup:

```env
AUTH_SECRET=<npx auth secret>
AUTH_MICROSOFT_ENTRA_ID_ID=<Client ID>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<Client Secret>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<TENANT_ID>/v2.0
NEXT_PUBLIC_AZURE_MAPS_KEY=<Azure Maps Key>
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<API Key>
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
```

```bash
npm run dev   # → http://localhost:3000
```

> Requires: Node.js 18+, Azure subscription, Entra ID app registration

---

## Documentation

- [Full Specification](specs/001-map-first-mvp/spec.md) — User stories & acceptance criteria
- [LangGraph Migration](specs/002-langgraph-migration/spec.md) — Agent architecture
- [OpenAPI Contract](specs/001-map-first-mvp/contracts/openapi.yaml)
- [Copilot Usage](docs/copilot-notes.md) — AI-assisted development process
