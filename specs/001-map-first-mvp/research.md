# Research: LinkUp Map-First MVP + AI Foundry Semantic Search + MCP Integration

**Feature**: `001-map-first-mvp`
**Date**: 2026-02-12 (Updated: 2026-02-12)

## Research → Milestone Mapping

| Research | Milestone | Key Decision |
|----------|-----------|-------------|
| R1. Azure Maps | M2 (22–38m) | `react-azure-maps` v1 + `azure-maps-control` v3 |
| R2. Entra ID Auth | M1 (10–22m) | Auth.js v5 + `microsoft-entra-id` provider |
| R3. Storage | M0 (0–10m) | `better-sqlite3` file-based DB |
| R4. MCP Integration | M5 (75–88m) | `@modelcontextprotocol/sdk` v1.26+, multi-source (Docs+Issues+Posts) |
| R5. Framework & Testing | M0 (0–10m) | Next.js 14 App Router + Vitest |
| R6. 3-Sentence Validation | M3 (38–58m) | Regex-based sentence counting (URL/ellipsis exclusion) |
| R7. AI Foundry | M4 (58–75m) | `openai` (AzureOpenAI) + `text-embedding-3-small` + `gpt-4o-mini` |

---

## R1. Azure Maps Web SDK + Next.js Integration

### Decision
Use `azure-maps-control` v3 + `react-azure-maps` v1 for declarative React components.

### Rationale
- `react-azure-maps` is maintained under the Azure GitHub org and wraps `azure-maps-control` with Context/hooks
- Provides `<AzureMap>`, `<AzureMapHtmlMarker>`, `<AzureMapPopup>` — fits our marker/popup needs directly
- Requires `'use client'` directive (no SSR); may need `next/dynamic` with `ssr: false` if SSR errors occur
- CSS must be imported: `azure-maps-control/dist/atlas.min.css`

### Alternatives Considered
- **Vanilla SDK in `useEffect`**: More control but more boilerplate; unnecessary for MVP scope
- **Leaflet / MapLibre GL**: Not Azure Maps (Constitution mandates Azure Maps Web SDK)

### Auth for Maps
- MVP: Subscription key via `NEXT_PUBLIC_AZURE_MAPS_KEY` env var
- Production: Entra ID token auth (anonymous + server-side token fetch pattern)

---

## R2. Entra ID Authentication

### Decision
Use Auth.js v5 (NextAuth beta) with the built-in `microsoft-entra-id` provider.

### Rationale
- Single package (`next-auth@beta`), zero MSAL dependencies
- Built-in Entra ID provider at `next-auth/providers/microsoft-entra-id`
- Works with App Router: route handler at `app/api/auth/[...nextauth]/route.ts`
- Server-side session handling, middleware protection, API route auth out of the box
- Required env vars: `AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
- Redirect URI: `http://localhost:3000/api/auth/callback/microsoft-entra-id`

### Alternatives Considered
- **MSAL.js (@azure/msal-browser + @azure/msal-react)**: Designed for pure SPAs, doesn't integrate with Next.js server components/SSR/API routes; more complex for MVP
- **Custom OAuth2 flow**: Too much ceremony for 100-minute build

---

## R3. Storage

### Decision
Use `better-sqlite3` for persistent, file-based storage.

### Rationale
- Zero-config: `npm install better-sqlite3`, create DB file, `CREATE TABLE IF NOT EXISTS`
- Synchronous API: no async/await ceremony — `db.prepare(...).run(...)`
- TTL filtering: `WHERE expiresAt > datetime('now')`
- Unique constraint: `UNIQUE(postId, userId)` on Engagement table
- Survives process restarts (unlike in-memory stores)
- Inspectable with any SQLite GUI for debugging
- ~15 minutes setup for 2 tables

### Alternatives Considered
- **In-memory (globalThis Map)**: Fastest (5 min) but loses data on restart; unreliable for demo rehearsal
- **Prisma + SQLite**: ~30 min setup, overkill ORM ceremony for 2 entities in 100-minute MVP
- **JSON file**: No concurrent-write safety, manual unique constraints; strictly worse than better-sqlite3

### Fallback
If `better-sqlite3` native addon fails to install (rare on Windows/Mac/Linux), fall back to `globalThis` in-memory Map with compound key `${postId}:${userId}`.

---

## R4. MCP Integration (Enhanced — FR7.1~7.5)

### Decision
Use `@modelcontextprotocol/sdk` (v1.26+) with **InMemoryTransport** (in-process).
Integrate the MCP server as an internal module within the Next.js app, running in a single process.
Build a custom MCP server that exposes multi-source search tools (Docs + Issues + Posts)
and integrates with AI Foundry for semantic search and Action Hint generation.

### Rationale
- Official TypeScript SDK: `@modelcontextprotocol/sdk` (14M weekly downloads, MIT)
- Peer dependency: `zod` for schema validation
- Client API: `Client.connect()` → `client.listTools()` → tool definitions for LLM → `client.callTool(name, args)` → results
- **InMemoryTransport**: `InMemoryTransport.createLinkedPair()` — connects MCP client and server within the same process
- No separate HTTP server/port needed, eliminates per-request transport bugs
- Tools can directly access the app's AI Foundry client and PostEmbedding cache

### LLM-Driven MCP Tool Orchestration Pattern (FR-023)
The standard MCP integration pattern uses LLM function-calling to drive tool selection.
The MCP server runs as an internal module (`app/lib/mcp/server.ts`),
connected to the client via `InMemoryTransport`.

```
1. App: Create McpServer singleton + InMemoryTransport.createLinkedPair()
2. App → MCP Server (in-process): listTools() → discover available tools + schemas
3. App: Convert MCP tool schemas → OpenAI function-calling format
4. App → LLM (GPT-4o-mini): user query + tool definitions
5. LLM → App: tool_calls[] (which tools to call with what args)
6. App → MCP Server (in-process): callTool(name, args) for each tool call
7. App → LLM: tool results as assistant messages
8. LLM → App: final structured response (JSON with categorized results + actionHint)
```

**Why in-process integration**:
- Tools directly access the PostEmbedding cache — no HTTP callback needed for `search_posts`
- Single AI Foundry client — eliminates duplicate code
- Reduced operational complexity — single process, single deployment

**Why LLM orchestration matters**:
- The app doesn't hardcode which tools to call — if new tools are added to the
  MCP server (e.g., `search_stackoverflow`), the LLM automatically discovers and uses them
- The LLM can choose NOT to call certain tools if irrelevant to the query
- The LLM generates the Action Hint as part of its final response,
  using all tool results as context (no separate `generate_action_hint` tool call needed from app side)
- This is the canonical MCP pattern: LLM ↔ tool-use loop

**Fallback when AI Foundry is unavailable**:
- Fall back to hardcoded parallel tool calls (existing pattern without LLM)
- Template-based Action Hint generation

### Enhanced MCP Server Plan (FR7.1~7.5)
- **FR7.1 — Multi-source search**: The MCP server exposes search tools in two tiers:
  - **PRIMARY (M365 internal resources)**:
    - `search_m365`: M365 unified search (consolidates OneDrive/SharePoint/Email into a single tool)
  - **SUPPLEMENTARY (web resources)**:
    - `search_docs`: Azure Docs/Learn search (or hardcoded data for MVP)
    - `search_issues`: GitHub Issues search (or hardcoded data for MVP)
  - `search_posts`: Internal post DB semantic search (using AI Foundry embeddings)
- **FR7.2 — AI Foundry semantic search**: MCP tools use the app's shared AI Foundry client (`app/lib/ai-foundry.ts`)
  to embed query text and rank against pre-embedded Docs/Issues via cosine similarity.
  Posts search directly accesses the PostEmbedding cache via `getAllEmbeddings()` (no HTTP callback needed).
- **FR7.3 — Map re-filtering**: Adds a `bbox` parameter to the `search_combined` tool,
  re-filtering coordinate-bearing results (Posts) to the current map view area.
- **FR7.4 — Action Hint**: MCP tools call `gpt-4o-mini` via the app's AI Foundry client
  to generate a one-line next action suggestion. Falls back to template when AI Foundry is unavailable.
  Exposed as a separate `generate_action_hint` tool.
- **FR7.5 — Combined UI**: The API response returns results by category in the form `{ m365: [], docs: [], issues: [], posts: [], actionHint: string }`,
  and the UI displays them as a single combined section with **M365 sources at the top (primary) and web sources at the bottom (supplementary)**.

### MCP Server In-Process Integration
- MCP server runs as an internal module (`app/lib/mcp/server.ts`) — no separate process
- Client-server connection via `InMemoryTransport.createLinkedPair()`
- All tools share the app's single AI Foundry client (`app/lib/ai-foundry.ts`)
- `search_posts` directly accesses the PostEmbedding cache — HTTP callback eliminated

**Simplified Data Flow (in-process)**:
```
Next.js App (:3000)
├── AI Foundry (embeddings + chat)───┐
│   └── PostEmbedding cache (in-memory)  │
├── MCP Server (in-process)             │
│   ├── search_docs: embed → cosine    │ same process
│   ├── search_issues: embed → cosine  │ direct access
│   ├── search_posts: PostEmbedding ←─┘
│   └── action_hint: GPT-4o-mini
└── MCP Client (InMemoryTransport)
    └── LLM orchestration (function-calling)
```

### Graceful Degrade Strategy
- Total MCP server failure: Display "No suggestions available"
- Partial source failure (e.g., SharePoint fails): Display only successful sources (OneDrive/Email/Docs/Posts), show "unavailable" label for failed sources
- Even if all M365 sources fail, web source results (Docs/Issues) are still displayed
- Action Hint generation failure (AI Foundry unavailable): template fallback; hide hint area on final failure
- AI Foundry embedding failure (query embedding fails): return all pre-embedded data (fallback)
- `/api/search` callback failure: `search_posts` returns an empty array

### Alternatives Considered
- **Community `@modelcontextprotocol/server-fetch`**: Too general, cannot combine multi-source results
- **Direct API call without MCP**: Violates Constitution principle 4.1 ("Suggested Resources MUST go through MCP server")
- **Single search_resources tool**: Insufficient to prove FR7.5 combined approach — requires per-source separation + combination
- **Hardcoded tool calls without LLM**: Technically works but misses the core value of MCP
  (dynamic tool discovery + LLM-driven selection). Does not scale when new tools are added.
  Used only as a fallback when AI Foundry is unavailable.
- **Separate sidecar process (:3001)**: Requires HTTP callback for `search_posts` (PostEmbedding cache
  is in app memory), per-request McpServer instance management, duplicate AI Foundry clients,
  and dual-process deployment. Adds operational complexity without benefit for this MVP.

---

## R5. Project Framework & Testing

### Decision
- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Testing**: Vitest (unit) for 100-minute MVP; integration tests deferred to post-MVP

### Rationale
- Next.js App Router provides API routes + React UI in one project
- TypeScript for type safety across all layers
- Vitest: zero-config with Next.js, fast, ESM-native
- Full integration/e2e testing is outside 100-minute scope

---

## R7. AI Foundry Integration (FR7.2, FR7.3, FR7.4)

### Decision
Use `openai` npm package (AzureOpenAI class) + `@azure/identity` for
Azure OpenAI Service calls. Handles both Embeddings (semantic search) and Chat Completions (Action Hint).

### Rationale
- The `openai` package provides the `AzureOpenAI` class that connects directly to Azure OpenAI endpoints
- The AI Foundry project client (`@azure/ai-projects`) is overkill for MVP — the `openai` package alone is sufficient
- 2 model deployments required: `text-embedding-3-small` (embeddings), `gpt-4o-mini` (Action Hint)

### Semantic Search Pattern (FR7.2, FR7.3)
- Post text → generate embedding vector via `text-embedding-3-small`
- Compare with pre-embedded vectors of Docs/Issues/Posts data via cosine similarity
- MVP: Small dataset so in-memory vector comparison is sufficient
- Map re-filtering (FR7.3): Filter Posts results to only coordinates within bbox range

### Action Hint Pattern (FR7.4)
- Call `gpt-4o-mini` Chat Completion with top 3 search results as context
- System prompt: "Based on these search results, suggest ONE next action in one sentence."
- Limit to `max_tokens: 60` to ensure one-line output
- On failure: hide hint area (graceful degrade)

### Authentication
- Chat Completions: `DefaultAzureCredential` via `getBearerTokenProvider` supported
- Embeddings v1 API: API key required (`AZURE_OPENAI_API_KEY`)
- Entra ID scope: `https://cognitiveservices.azure.com/.default`

### Required Env Vars
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI resource endpoint
- `AZURE_OPENAI_API_KEY`: API key (for embeddings)
- `AZURE_OPENAI_CHAT_DEPLOYMENT`: gpt-4o-mini deployment name
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`: text-embedding-3-small deployment name

### Alternatives Considered
- **@azure-rest/ai-inference**: Beta (1.0.0-beta.6), model-agnostic but unstable
- **@azure/ai-projects**: Full AI Foundry project client, overkill for MVP
- **Azure AI Search**: Optimal for production but excessive setup time (index creation, etc.)

### Fallback
If Azure OpenAI Service is unavailable (demo environment limitations): can substitute with hardcoded embeddings + results.

---

## R6. 3-Sentence Validation Strategy

### Decision
Count sentence-ending punctuation (`.`, `?`, `!`, and Korean equivalents) while excluding:
- Dots inside URLs (regex: `https?://\S+`)
- Ellipsis (`...`)
- Abbreviations (common patterns like `e.g.`, `i.e.`)

### Rationale
- Spec FR-005 requires both UI and server validation
- Edge case from spec: "Dots (.) inside URLs must not be treated as sentence delimiters"
- Simple regex approach is sufficient for MVP; ML-based sentence detection is overkill
- Validation function shared between frontend (real-time feedback) and API route (enforcement)

---

## R7. Azure AI Foundry / Azure OpenAI — Node.js Integration

**Date**: 2026-02-11

### Context
We need two AI capabilities from a Next.js API route (server-side):
1. **Semantic search** — embed a post's text and find similar docs/issues
2. **Action Hint generation** — produce a 1-line next-action suggestion from MCP search results

### Available SDK Options

| Package | Version | Purpose | Status |
|---|---|---|---|
| `openai` | 6.21.0 | Official OpenAI SDK; has `AzureOpenAI` class for Azure | **Stable, recommended by Microsoft** |
| `@azure/openai` | 2.0.0 | Thin Azure-specific wrapper — re-exports `AzureOpenAI` from `openai`, adds type augmentations | Stable companion to `openai` |
| `@azure-rest/ai-inference` | 1.0.0-beta.6 | Azure AI Inference REST client (model-agnostic; works with Azure AI Foundry model endpoints) | Beta |
| `@azure/ai-projects` | 1.0.1 | Azure AI Foundry project client (agents, deployments, connections, datasets, indexes) | Stable (1.x = Foundry classic) |

### MVP Recommendation: Use `openai` + `@azure/identity` directly

For a 100-minute MVP, the **simplest path** is calling Azure OpenAI Service directly via the official `openai` npm package with the `AzureOpenAI` class. No AI Foundry project client needed.

**Packages to install:**
```
npm install openai @azure/identity
```

### Initialization Pattern

```typescript
import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

const credential = new DefaultAzureCredential();
const azureADTokenProvider = getBearerTokenProvider(
  credential,
  "https://cognitiveservices.azure.com/.default"
);

const client = new AzureOpenAI({
  azureADTokenProvider,
  apiVersion: "2024-10-21",
  // endpoint is read from AZURE_OPENAI_ENDPOINT env var, or set explicitly
});
```

### Embeddings (Semantic Search)

```typescript
const embedding = await client.embeddings.create({
  model: "text-embedding-3-small",  // deployment name
  input: "Post text goes here (3 sentences)",
});
// embedding.data[0].embedding → float[] vector (1536 dims)
```

Then compare vectors via cosine similarity against pre-embedded docs/issues. For MVP, can do in-memory comparison. For production, use Azure AI Search vector index.

**Note:** The Azure OpenAI embeddings API does **not** currently support Entra ID auth with the v1 API route. For embeddings specifically, an **API key** may be required:
```typescript
import OpenAI from "openai";
const embeddingClient = new OpenAI({
  baseURL: `https://${RESOURCE_NAME}.openai.azure.com/openai/v1/`,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
});
```

### Text Completion (Action Hint)

```typescript
const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",  // deployment name — cheapest/fastest
  messages: [
    {
      role: "system",
      content: "Generate exactly one short action hint sentence based on the search results provided.",
    },
    {
      role: "user",
      content: `Post: "${postText}"\n\nSearch results:\n${JSON.stringify(searchResults)}`,
    },
  ],
  max_tokens: 60,
  temperature: 0.3,
});
const actionHint = completion.choices[0].message.content;
// → "Review the API rate-limiting design doc before implementing the retry logic."
```

### Alternative: `@azure-rest/ai-inference`

The `@azure-rest/ai-inference` package offers a model-agnostic REST client that works with any Azure-deployed model:

```typescript
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { DefaultAzureCredential } from "@azure/identity";

const client = ModelClient(endpoint, new DefaultAzureCredential());

// Chat completion
const response = await client.path("/chat/completions").post({
  body: { messages: [{ role: "user", content: "..." }], max_tokens: 60 },
});

// Embeddings
const embResponse = await client.path("/embeddings").post({
  body: { input: ["text1", "text2"] },
});
```

**Pros:** Supports `DefaultAzureCredential` for all operations; model-agnostic.  
**Cons:** Still in beta (1.0.0-beta.6); less community adoption.

### Authentication Options

| Method | Description | MVP? |
|---|---|---|
| `DefaultAzureCredential` | Entra ID — uses `az login`, managed identity, env vars | Recommended for chat completions |
| `getBearerTokenProvider` | Wraps `DefaultAzureCredential` for the `AzureOpenAI` class | ✅ Best for `AzureOpenAI` |
| API Key | `AZURE_OPENAI_API_KEY` env var | Simplest; **required for embeddings via v1 API** |
| Managed Identity | For production (App Service, ACA, etc.) | Post-MVP |

**Scope for Entra ID tokens:** `https://cognitiveservices.azure.com/.default`

### Decision for MVP

1. **Install** `openai` + `@azure/identity` (optionally `@azure/openai` for type augmentations)
2. **Chat completions (Action Hint):** Use `AzureOpenAI` with `getBearerTokenProvider` + `DefaultAzureCredential`
3. **Embeddings (Semantic Search):** Use API key auth via `AZURE_OPENAI_API_KEY` (Entra ID not supported on embeddings v1 API)
4. **Model deployments needed:** `text-embedding-3-small` + `gpt-4o-mini` (cheapest options)
5. **If AI Foundry project is pre-provisioned:** Can optionally use `@azure/ai-projects` for connection management, but it adds complexity with zero benefit for a 2-endpoint MVP
6. **Fallback for demo:** Hardcoded search results + static Action Hint string if Azure services unavailable
