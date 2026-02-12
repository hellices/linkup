# LinkUp — Map-First Collaboration MVP

3문장 포스트 + 지도 기반 탐색 + MCP 추천 + 협업 매칭을 100분 안에 빌드한 MVP.

## Architecture

```
Next.js 14 App (:3000)           MCP Server (:3001)
┌──────────────────────┐         ┌──────────────────┐
│ Azure Maps + React   │         │ search_docs      │
│ Auth.js + Entra ID   │  HTTP   │ search_issues    │
│ SQLite (better-sqlite)├────────┤ search_posts     │
│ AI Foundry client    │         │ generate_action   │
│ MCP client           │         │   _hint          │
└──────────────────────┘         └──────────────────┘
```

## Key Features

- **Map-First**: Azure Maps 기반 전체 화면 지도 위에 포스트 마커 표시
- **3-Sentence Posts**: 문장 제한 검증 (URL/ellipsis 제외), TTL 필수
- **AI Foundry Semantic Search**: `text-embedding-3-small` 임베딩 → cosine similarity → 지도 bbox 재필터링
- **MCP Multi-Source**: Docs + Issues + Posts 결합 검색 → "Suggested via MCP" 카테고리별 표시
- **Action Hint**: 검색 결과 기반 1줄 다음 행동 제안 (강조 스타일)
- **Collaboration**: Interested / Join 참여 (멱등 처리)
- **Ephemeral**: TTL 만료 → 조회 시점 필터링으로 자동 제외

## Quick Start

See [specs/001-map-first-mvp/quickstart.md](specs/001-map-first-mvp/quickstart.md) for full setup instructions.

```bash
# Install
npm install

# Start MCP server (terminal 1)
npm run mcp

# Start Next.js app (terminal 2)
npm run dev
```

## Documentation

- [Specification](specs/001-map-first-mvp/spec.md)
- [Implementation Plan](specs/001-map-first-mvp/plan.md)
- [MCP Architecture](docs/mcp.md)
- [Copilot Usage Notes](docs/copilot-notes.md)
- [OpenAPI Contract](specs/001-map-first-mvp/contracts/openapi.yaml)
