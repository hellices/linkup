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
Use `@modelcontextprotocol/sdk` (v1.26+) with Streamable HTTP transport.
Build a custom MCP server that exposes multi-source search tools (Docs + Issues + Posts)
and integrates with AI Foundry for semantic search and Action Hint generation.

### Rationale
- Official TypeScript SDK: `@modelcontextprotocol/sdk` (14M weekly downloads, MIT)
- Peer dependency: `zod` for schema validation
- Client API: `Client.connect()` → `client.callTool("search_combined", { query, sources })` → returns combined results
- Works in Next.js API routes (pure Node.js, no browser APIs)
- Streamable HTTP transport (`StreamableHTTPClientTransport`) for remote MCP server

### Enhanced MCP Server Plan (FR7.1~7.5)
- **FR7.1 — Multi-source search**: MCP 서버는 최소 2개 도구를 노출한다:
  - `search_docs`: Azure Docs/Learn 검색 (또는 MVP용 하드코딩 데이터)
  - `search_issues`: GitHub Issues 검색 (또는 MVP용 하드코딩 데이터)
  - `search_posts`: 내부 포스트 DB semantic search (AI Foundry 임베딩 활용)
- **FR7.2 — AI Foundry semantic search**: 포스트 텍스트를 임베딩하고,
  Docs/Issues/Posts를 cosine similarity로 랭킹하여 연관도 높은 결과를 반환한다.
- **FR7.3 — 지도 재필터링**: `search_combined` 도구에 `bbox` 파라미터를 추가하여,
  좌표가 있는 결과(Posts)를 현재 지도 뷰 영역으로 재필터링한다.
- **FR7.4 — Action Hint**: AI Foundry `gpt-4o-mini`를 호출하여 검색 결과 기반
  1줄 다음 행동 제안을 생성한다. 별도 도구 `generate_action_hint`로 노출.
- **FR7.5 — 결합 UI**: API 응답은 `{ docs: [], issues: [], posts: [], actionHint: string }` 형태로
  카테고리별 결과를 반환하고, UI에서 하나의 결합된 섹션으로 표시한다.

### Graceful Degrade Strategy
- 전체 MCP 서버 장애: "No suggestions available" 표시
- 부분 소스 실패 (e.g., Issues 실패): 성공한 소스(Docs/Posts)만 표시, 실패 소스는 "unavailable" 라벨
- Action Hint 생성 실패: 힌트 영역 숨김, 결과 목록만 표시
- AI Foundry 임베딩 실패: Fallback으로 키워드 기반 텍스트 매칭 사용

### Alternatives Considered
- **Community `@modelcontextprotocol/server-fetch`**: Too general, multi-source 결합 불가
- **Direct API call without MCP**: Violates Constitution principle 4.1 ("Suggested Resources MUST go through MCP server")
- **단일 search_resources 도구**: FR7.5 결합 증명에 불충분 — 소스별 분리 + 결합 필요

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
Azure OpenAI Service 호출. Embeddings(semantic search)와 Chat Completions(Action Hint)를 모두 처리.

### Rationale
- `openai` 패키지는 `AzureOpenAI` 클래스를 제공하며 Azure OpenAI 엔드포인트에 직접 연결
- AI Foundry 프로젝트 클라이언트(`@azure/ai-projects`)는 MVP에 과도함 — `openai` 패키지만으로 충분
- 2개 모델 배포 필요: `text-embedding-3-small` (임베딩), `gpt-4o-mini` (Action Hint)

### Semantic Search Pattern (FR7.2, FR7.3)
- 포스트 텍스트 → `text-embedding-3-small`로 임베딩 벡터 생성
- Docs/Issues/Posts 데이터의 사전 임베딩 벡터와 cosine similarity 비교
- MVP: 소규모 데이터셋이므로 인메모리 벡터 비교로 충분
- 지도 재필터링(FR7.3): Posts 결과 중 bbox 범위 내 좌표만 필터링

### Action Hint Pattern (FR7.4)
- 검색 결과(상위 3개)를 컨텍스트로 `gpt-4o-mini` Chat Completion 호출
- System prompt: "Based on these search results, suggest ONE next action in one sentence."
- `max_tokens: 60` 으로 제한하여 1줄 보장
- 실패 시: 힌트 영역 숨김 (graceful degrade)

### Authentication
- Chat Completions: `DefaultAzureCredential` via `getBearerTokenProvider` 지원
- Embeddings v1 API: API key 필수 (`AZURE_OPENAI_API_KEY`)
- Entra ID scope: `https://cognitiveservices.azure.com/.default`

### Required Env Vars
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI 리소스 엔드포인트
- `AZURE_OPENAI_API_KEY`: API 키 (임베딩용)
- `AZURE_OPENAI_CHAT_DEPLOYMENT`: gpt-4o-mini 배포명
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`: text-embedding-3-small 배포명

### Alternatives Considered
- **@azure-rest/ai-inference**: Beta(1.0.0-beta.6), 모델-불가지론적이지만 불안정
- **@azure/ai-projects**: AI Foundry 프로젝트 전체 클라이언트, MVP에 과도
- **Azure AI Search**: 프로덕션용 최적이지만 설정 시간 과다 (인덱스 생성 등)

### Fallback
Azure OpenAI 서비스 미사용 시(데모 환경 제한): 하드코딩된 임베딩 + 결과로 대체 가능.

---

## R6. 3-Sentence Validation Strategy

### Decision
Count sentence-ending punctuation (`.`, `?`, `!`, and Korean equivalents) while excluding:
- Dots inside URLs (regex: `https?://\S+`)
- Ellipsis (`...`)
- Abbreviations (common patterns like `e.g.`, `i.e.`)

### Rationale
- Spec FR-005 requires both UI and server validation
- Edge case from spec: "URL 내 점(.)은 문장 구분으로 처리하지 않아야 한다"
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
