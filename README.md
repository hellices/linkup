# LinkUp — Map-First Collaboration MVP

MVP built in 100 minutes with 3-sentence posts + map-based discovery + MCP recommendations + collaboration matching.

## Architecture

```
Next.js 14 App (:3000) — single process
┌──────────────────────────────────────────┐
│ Azure Maps + React                       │
│ Auth.js + Entra ID                       │
│ SQLite (better-sqlite3)                  │
│ AI Foundry client (embeddings + chat)    │
│                                          │
│ MCP Server (in-process, InMemoryTransport)│
│  ├── search_m365      (PRIMARY: OneDrive/SharePoint/Email)
│  ├── search_posts     (direct cache)     │
│  └── generate_action_hint               │
│                                          │
│ MCP Client ── LLM-driven orchestration   │
│  └── GPT-4o-mini decides tool calls      │
│      + Multi-Query Expansion             │
└──────────────────────────────────────────┘
```

No separate sidecar process — the MCP server runs in-process via `InMemoryTransport`,
directly accessing the app's PostEmbedding cache, AI Foundry client, and DB.

## Key Features

- **Map-First**: Full-screen map with post markers powered by Azure Maps
- **3-Sentence Posts**: Sentence limit validation (excluding URLs/ellipsis), TTL required
- **AI Foundry Semantic Search**: `text-embedding-3-small` embeddings → cosine similarity → map bbox re-filtering
- **MCP Multi-Source**: **M365 internal resources (OneDrive/SharePoint/Email) as primary** + similar Posts → categorized display with "Suggested via MCP"
- **LLM-Driven Orchestration**: GPT-4o-mini discovers tools via `listTools()`, performs Multi-Query Expansion (2–3 diverse search queries), and decides which tools to call — no hardcoded tool selection
- **Action Hint**: One-line next-action suggestion based on search results (highlighted style)
- **Collaboration**: Interested / Join participation (idempotent, Interested→Join upgrade)
- **Ephemeral**: TTL expiration → startup cleanup sweep + query-time filtering (`expiresAt > now`)

## Quick Start

See [specs/001-map-first-mvp/quickstart.md](specs/001-map-first-mvp/quickstart.md) for full setup instructions.

```bash
# Install
npm install

# Start Next.js app (MCP server runs in-process, no separate terminal needed)
npm run dev
```

## Documentation

- [Specification](specs/001-map-first-mvp/spec.md)
- [Implementation Plan](specs/001-map-first-mvp/plan.md)
- [MCP Architecture](docs/mcp.md)
- [Copilot Usage Notes](docs/copilot-notes.md)
- [OpenAPI Contract](specs/001-map-first-mvp/contracts/openapi.yaml)
