# LinkUp — Map-First Collaboration MVP

MVP built in 100 minutes with 3-sentence posts + map-based discovery + MCP recommendations + collaboration matching.

## Architecture

```
Next.js 14 App (:3000)
┌──────────────────────────────────┐
│ Azure Maps + React               │
│ Auth.js + Entra ID               │
│ SQLite (better-sqlite3)          │
│ AI Foundry client                │
│ In-Process MCP Server            │
│ ├─ search_docs                   │
│ ├─ search_issues                 │
│ ├─ search_posts                  │
│ └─ generate_action_hint          │
└──────────────────────────────────┘
```

**Note**: MCP runs in-process using `InMemoryTransport` (no separate server).

## Key Features

- **Map-First**: Full-screen map with post markers powered by Azure Maps
- **3-Sentence Posts**: Sentence limit validation (excluding URLs/ellipsis), TTL required
- **AI Foundry Semantic Search**: `text-embedding-3-small` embeddings → cosine similarity → map bbox re-filtering
- **MCP Multi-Source**: Combined search across Docs + Issues + Posts → categorized display with "Suggested via MCP"
- **Action Hint**: One-line next-action suggestion based on search results (highlighted style)
- **Collaboration**: Interested / Join participation (idempotent)
- **Ephemeral**: TTL expiration → automatically excluded via query-time filtering

## Quick Start

See [specs/001-map-first-mvp/quickstart.md](specs/001-map-first-mvp/quickstart.md) for full setup instructions.

```bash
# Install
npm install

# Start Next.js app
npm run dev
```

## Documentation

- [Specification](specs/001-map-first-mvp/spec.md)
- [Implementation Plan](specs/001-map-first-mvp/plan.md)
- [MCP Architecture](docs/mcp.md)
- [Copilot Usage Notes](docs/copilot-notes.md)
- [OpenAPI Contract](specs/001-map-first-mvp/contracts/openapi.yaml)
