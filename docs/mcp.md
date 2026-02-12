# MCP Server Architecture — LinkUp MVP

## Overview

LinkUp의 MCP 서버는 사이드카 프로세스(port 3001)로 실행되며,
Streamable HTTP transport를 통해 Next.js 앱과 통신합니다.

## Architecture

```
┌─────────────────────────────────────────┐
│           Next.js App (:3000)           │
│                                         │
│  ┌─────────────┐   ┌────────────────┐  │
│  │ PostPopup   │   │ SearchBar      │  │
│  │ Component   │   │ Component      │  │
│  └──────┬──────┘   └───────┬────────┘  │
│         │                   │           │
│  ┌──────▼──────┐   ┌───────▼────────┐  │
│  │ /api/posts/ │   │ /api/search    │  │
│  │ [id]/       │   │                │  │
│  │ suggestions │   │ (AI Foundry    │  │
│  └──────┬──────┘   │  embeddings)   │  │
│         │           └───────┬────────┘  │
│  ┌──────▼──────────────────▼─────────┐ │
│  │           MCP Client              │ │
│  │    (lib/mcp-client.ts)            │ │
│  └──────────────┬────────────────────┘ │
└─────────────────┼──────────────────────┘
                  │ HTTP (Streamable)
┌─────────────────▼──────────────────────┐
│        MCP Server (:3001)              │
│                                         │
│  ┌─────────────┐ ┌─────────────┐       │
│  │ search_docs │ │search_issues│       │
│  │   (3 docs)  │ │  (2 issues) │       │
│  └─────────────┘ └─────────────┘       │
│  ┌──────────────┐ ┌────────────────┐   │
│  │ search_posts │ │generate_action │   │
│  │  (delegated) │ │    _hint       │   │
│  └──────────────┘ └────────────────┘   │
└─────────────────────────────────────────┘
```

## Multi-Source Value

MCP가 단순 래퍼가 아닌 "기능"인 이유:

1. **Docs + Issues 결합**: 하나의 API 호출로 Azure Docs와 GitHub Issues를
   동시에 검색하고 카테고리별로 구분하여 표시합니다.

2. **Action Hint**: 검색 결과를 분석하여 구체적인 다음 행동을 1줄로 제안합니다.
   (예: "Step 2를 먼저 확인하세요")

3. **Graceful Degrade**: 부분 실패 시 성공한 소스만 표시하고,
   실패한 소스는 "unavailable"로 표시합니다.

## Tools

| Tool | Input | Output | Source |
|------|-------|--------|--------|
| `search_docs` | query string | McpSuggestion[] (max 3) | Pre-embedded Azure Docs |
| `search_issues` | query string | McpSuggestion[] (max 2) | Pre-embedded GitHub Issues |
| `search_posts` | query string, excludePostId? | PostSummary[] | Delegated to app |
| `generate_action_hint` | postText, searchResults[] | string (1 line) | Template or GPT-4o-mini |

## Docs + Issues Integration Flow

```
User clicks marker → PostPopup opens
                   → GET /api/posts/{id}/suggestions
                   → MCP Client connects to MCP Server
                   → Parallel calls:
                       ├─ search_docs(postText) → Azure Docs 1~3개
                       ├─ search_issues(postText) → GitHub Issues 0~2개
                       └─ search_posts(postText) → Similar Posts 0~5개
                   → generate_action_hint(postText, results)
                   → Combined response:
                       {docs, issues, posts, actionHint, source: "mcp"}
                   → SuggestionsPanel renders categorized results
```
