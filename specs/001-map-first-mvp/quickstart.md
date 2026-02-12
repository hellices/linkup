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
AZURE_OPENAI_API_KEY=<Azure OpenAI API Key (for embeddings)>
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
```

## 3. Start Development Server

```bash
npm run dev
# Opens http://localhost:3000
# MCP server runs in-process (InMemoryTransport) — no separate process needed
```

## 4. Demo Script (2 minutes)

1. Open `http://localhost:3000` → Click "Sign in with Microsoft" → Entra ID login
2. Map loads centered on default location (Redmond, WA)
3. Click "+" FAB → Type 3-sentence post + select TTL (1min for demo) → Save
4. New marker appears on map → Click marker
5. Popup shows: post text, time remaining, **"Suggested via MCP"** with:
   - 1–3 Docs suggestions
   - 0–2 Issues suggestions
   - 0–5 similar Posts (AI Foundry semantic search)
   - **Action Hint** one-line (e.g., "High likelihood of resolution based on Docs — check Step 2 first.")
6. Use **search bar** → AI Foundry semantic search → only results within map area are displayed as markers
7. Click "Join" → participant count updates
8. Wait ~1 minute → refresh → marker disappears (TTL expired)

## 5. Verify Acceptance Criteria

| AC | How to verify |
|----|---------------|
| AC1 | Entra login → map screen appears |
| AC2 | Type 4+ sentences → save blocked (UI + API) |
| AC3 | Post created → marker visible on map → click → popup |
| AC4 | Interested/Join button → count updates |
| AC5 | Popup shows "Suggested via MCP" with Docs+Posts (at least 2 categories) |
| AC6 | Action Hint one-line displayed at top of results |
| AC7 | Map search → semantic search → result markers displayed within bbox |
| AC8 | On MCP connection failure → "No suggestions available" displayed |
| AC9 | Wait for TTL → marker gone on refresh |
| AC10 | Full flow completes in < 2 minutes |

## Troubleshooting

- **Map not rendering**: Check `NEXT_PUBLIC_AZURE_MAPS_KEY` is set correctly
- **Auth redirect error**: Verify redirect URI in Entra portal matches exactly
- **MCP suggestions empty**: MCP runs in-process — check AI Foundry env vars are set
- **AI Foundry timeout**: Check `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`
- **Embeddings fail**: Embeddings require API key auth (Entra ID not supported on v1 API route)
- **Action Hint missing**: If gpt-4o-mini fails, hint area is hidden (graceful degrade)
- **SQLite error**: Run `npm rebuild better-sqlite3` if native addon issues
- **Semantic search no results**: Ensure posts have been created first (embeddings are generated on post creation)
