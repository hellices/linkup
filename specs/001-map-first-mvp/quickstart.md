# Quickstart: LinkUp Map-First MVP + AI Foundry + MCP

**Feature**: `001-map-first-mvp`

## Prerequisites

- Node.js 18+ and npm
- Azure subscription with:
  - Azure Maps account (subscription key)
  - Azure OpenAI Service with 2 deployments: `text-embedding-3-small`, `gpt-4o-mini`
- Entra ID (Azure AD) app registration with:
  - Client ID
  - Client Secret
  - Tenant ID
  - Redirect URI: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
- `az login` completed (for DefaultAzureCredential)

## 1. Clone & Install

```bash
git clone <repo-url> && cd linkup
git checkout 001-map-first-mvp
npm install
```

## 2. Environment Setup

Create `.env.local` at the project root:

```env
# Auth.js (NextAuth v5)
AUTH_SECRET=<generate with: npx auth secret>
AUTH_MICROSOFT_ENTRA_ID_ID=<Entra App Client ID>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<Entra App Client Secret>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<TENANT_ID>/v2.0

# Azure Maps
NEXT_PUBLIC_AZURE_MAPS_KEY=<Azure Maps Subscription Key>

# Azure OpenAI (AI Foundry)
AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com
AZURE_OPENAI_API_KEY=<Azure OpenAI API Key (임베딩용)>
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small

# MCP Server
MCP_SERVER_URL=http://localhost:3001/mcp
```

## 3. Start MCP Server (separate terminal)

```bash
npx tsx mcp-server/index.ts
# Runs on port 3001 by default
# Exposes tools: search_docs, search_issues, search_posts, generate_action_hint
```

## 4. Start Development Server

```bash
npm run dev
# Opens http://localhost:3000
```

## 5. Demo Script (2 minutes)

1. Open `http://localhost:3000` → Click "Sign in with Microsoft" → Entra ID login
2. Map loads centered on default location (Redmond, WA)
3. Click "+" FAB → Type 3-sentence post + select TTL (1min for demo) → Save
4. New marker appears on map → Click marker
5. Popup shows: post text, time remaining, **"Suggested via MCP"** with:
   - Docs 추천 1~3개
   - Issues 추천 0~2개
   - 유사 Posts 0~5개 (AI Foundry semantic search)
   - **Action Hint** 1줄 (예: "Docs 기반 해결 가능성이 높습니다 — Step 2를 먼저 확인하세요.")
6. Use **search bar** → AI Foundry semantic search → 지도 영역 내 결과만 마커로 표시
7. Click "Join" → participant count updates
8. Wait ~1 minute → refresh → marker disappears (TTL expired)

## 6. Verify Acceptance Criteria

| AC | How to verify |
|----|---------------|
| AC1 | Entra login → map screen appears |
| AC2 | Type 4+ sentences → save blocked (UI + API) |
| AC3 | Post created → marker visible on map → click → popup |
| AC4 | Interested/Join button → count updates |
| AC5 | Popup shows "Suggested via MCP" with Docs+Posts (최소 2종) |
| AC6 | Action Hint 1줄이 결과 상단에 표시됨 |
| AC7 | 지도 검색 → semantic search → bbox 내 결과 마커 표시 |
| AC8 | MCP 서버 중단 → "No suggestions available" 표시 |
| AC9 | Wait for TTL → marker gone on refresh |
| AC10 | Full flow completes in < 2 minutes |

## Troubleshooting

- **Map not rendering**: Check `NEXT_PUBLIC_AZURE_MAPS_KEY` is set correctly
- **Auth redirect error**: Verify redirect URI in Entra portal matches exactly
- **MCP suggestions empty**: Ensure MCP server is running on port 3001
- **AI Foundry timeout**: Check `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`; verify `az login` is valid
- **Embeddings fail**: Embeddings require API key auth (Entra ID not supported on v1 API route)
- **Action Hint missing**: If gpt-4o-mini fails, hint area is hidden (graceful degrade)
- **SQLite error**: Run `npm rebuild better-sqlite3` if native addon issues
- **Semantic search no results**: Ensure posts have been created first (embeddings are generated on post creation)
