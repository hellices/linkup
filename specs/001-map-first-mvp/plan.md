# Implementation Plan: LinkUp Map-First MVP + AI Foundry Semantic Search + MCP Integration

**Branch**: `001-map-first-mvp` | **Date**: 2026-02-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-map-first-mvp/spec.md`

## Summary

LinkUp은 Entra ID 인증 사용자가 지도 위에 3문장 이내 포스트를 게시하고, AI Foundry 기반 semantic search로 유사 포스트/문서/이슈를 추천받으며, MCP를 통해 multi-source 결합 검색(Docs + Issues) + Action Hint를 제공받고, Interested/Join으로 협업을 시작하는 지도 중심 초경량 앱의 MVP이다. 100분 내 End-to-End 구현하며, 전체 흐름을 2분 데모로 시연 가능해야 한다.

**핵심 기술 접근**:
- Next.js 14 App Router + TypeScript 단일 프로젝트
- `azure-maps-control` + `react-azure-maps`로 지도 렌더링
- Auth.js v5 (NextAuth beta) + Entra ID provider로 인증
- `better-sqlite3`로 경량 영속 저장
- `openai` (AzureOpenAI) + `@azure/identity`로 AI Foundry (임베딩 + 챗) 연동
- `@modelcontextprotocol/sdk`로 MCP 서버 연동 (Docs + Issues + Posts 결합)

## Objective

100분 내에 다음 End-to-End 경험을 완성한다:

- Entra 로그인
- Azure Maps 지도 표시
- 3문장 포스트 생성(TTL)
- 마커로 지도 표시
- 포스트 작성 시 AI Foundry 기반 연관 추천(Posts + Docs + Issues 중 최소 2종)
- 지도에서 검색 시 AI Foundry semantic search → 지도 영역 재필터링 표시
- MCP를 통한 multi-source 결합(Suggested via MCP + Action Hint)
- Interested/Join
- TTL 만료 제외 처리

전체 흐름은 2분 데모 가능해야 한다.

## Timebox Strategy (100 minutes)

- **AI Foundry 구현 비중 증가** → 대신 UI/부가 기능 축소
- **MCP 조회는 "Docs + (선택) Issues" 최소 구성**
- **Action Hint 생성은 간단 템플릿 방식**
- **지도-검색 재필터링은 semantic 결과 + bbox filtering**
- 스코어/랭킹/대시보드 기능은 이번 Plan에서 제외

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+
**Framework**: Next.js 14+ (App Router)
**Primary Dependencies**: `react-azure-maps`, `azure-maps-control` v3, `next-auth@beta` (Auth.js v5), `better-sqlite3`, `openai`, `@azure/identity`, `@modelcontextprotocol/sdk` v1.26+, `zod`
**Storage**: SQLite via `better-sqlite3` (file-based, zero-config)
**Testing**: Vitest (unit); integration tests deferred to post-MVP
**Target Platform**: Web (localhost:3000 for MVP)
**Project Type**: Web application (single Next.js project + MCP server sidecar)
**Performance Goals**: 포스트 생성 30초 이내, MCP 추천 결과 5초 이내, semantic search 3초 이내
**Constraints**: 100분 빌드 타임박스, 2분 데모 시연 가능, AI Foundry 호출 타임아웃 5초
**Scale/Scope**: MVP 단일 사용자 데모, 소규모 데이터셋 (인메모리 벡터 비교)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| 1.1 Lightweight by Design | ✅ PASS | 3문장 제한 유지, 최소 UI, 10초 내 질문 가능 |
| 1.2 Map-First Interaction | ✅ PASS | Azure Maps Web SDK 사용, 지도 중심 UI |
| 1.3 Connection Over Storage | ✅ PASS | Interested/Join → 다음 행동으로 연결, MCP Action Hint 제공 |
| 2.1 Mandatory TTL | ✅ PASS | 모든 포스트에 TTL 필수, 만료 시 조회 제외 |
| 2.2 Optional De-identified Summary | ✅ PASS | MVP에서 만료 후 데이터 삭제(요약 보관 없음) |
| 3.1 Entra ID Auth Only | ✅ PASS | Auth.js + Entra ID provider 사용 |
| 3.2 Minimum-Privilege | ✅ PASS | Maps: subscription key, Entra: 최소 scope |
| 3.3 Zero Sensitive Data | ✅ PASS | 로그 마스킹, PII 미저장, FR-019 준수 |
| 4.1 MCP as Core Capability | ✅ PASS | MCP 서버 통한 리소스 추천 필수 경로 |
| 4.2 Multi-source Knowledge | ✅ PASS | Docs + Issues + Posts 결합 검색 |
| 4.3 Transparency | ✅ PASS | "Suggested via MCP" 라벨 UI 표시 |
| 5.1 Intent-based Participation | ✅ PASS | Interested/Join 2단계 (Available은 post-MVP) |
| 5.2 No Heavy Social Graph | ✅ PASS | 친구/팔로우 기능 없음 |
| 6.x Rewards & Reputation | ⏭ SKIP | MVP 범위 밖 (스코어/대시보드 Cut List) |
| 7.1 Modular Architecture | ✅ PASS | UI/API/DB/MCP/AI Foundry 계층 분리 |
| 7.2 Observability | ⚠️ PARTIAL | MVP는 console.log 수준, 구조화 로그는 post-MVP |
| 8.1 Spec-Driven Flow | ✅ PASS | spec → plan → tasks → implement 순서 준수 |
| 8.3 MVP First | ✅ PASS | 100분 타임박스, 2분 데모 우선 |
| 9.x Non-Negotiable | ✅ PASS | GPS 추적/광고/영구 게시판/민감 정보 없음 |

**GATE RESULT: ✅ PASS** — 위반 없음. 7.2 Observability는 MVP 범위에서 의도적으로 최소화 (정당화: 100분 타임박스).

## Milestones & Timeline

### M0 (0–10m): Baseline Setup
- Next.js 초기화 (`create-next-app` + TypeScript + App Router)
- 환경변수 세팅 (Azure Maps key, Entra config, MCP endpoints, AI Foundry endpoint)
- 기본 레이아웃 + 지도 영역 자리만 배치
- `better-sqlite3` DB 초기화 (posts, engagements 테이블)

### M1 (10–22m): Entra ID Auth (Login Gate)
- Auth.js v5 + `microsoft-entra-id` provider 설정
- 로그인/로그아웃 UI (SignIn/SignOut 버튼)
- 비로그인 상태는 작성/참여 불가 (미들웨어 보호)
- Auth context만 우선 연결

### M2 (22–38m): Azure Maps 지도 렌더링 + 마커 샘플
- `react-azure-maps` 컴포넌트 연동 (`'use client'` + `next/dynamic`)
- 초기 지도 렌더 (기본 좌표: Redmond, WA) + 클릭 이벤트 수신
- 샘플 마커/팝업 표시
- CSS import (`azure-maps-control/dist/atlas.min.css`)

### M3 (38–58m): Post Creation (3문장 + TTL)
- Post 모델/API 구현 (`POST /api/posts`, `GET /api/posts`)
- 3문장 제한 (프론트+백 양쪽 검증, URL dots/ellipsis 제외)
- TTL 저장 → 만료 제외 GET 필터 (`WHERE expiresAt > datetime('now')`)
- 지도 클릭으로 (lat, lng) 결정
- Post 생성 후 지도 마커 렌더

### M4 (58–75m): AI Foundry Semantic Search 기능 구성 (핵심)
- `openai` 패키지로 `AzureOpenAI` 클라이언트 초기화
- AI Foundry 벡터 엔드포인트 호출 (`text-embedding-3-small` 임베딩)
- 포스트 텍스트 → 임베딩 벡터 생성 → cosine similarity 비교
- Semantic 결과 반환 구조 확정 (`{ docs: [], issues: [], posts: [] }`)
- "연관 포스트 추천" 데이터 쉐이프 통일
- 지도 검색 시: semantic 결과 → 현재 지도 bbox로 재필터링 후 마커 렌더
- Fallback: AI Foundry 미응답 시 하드코딩된 결과 반환

### M5 (75–88m): MCP Multi-Source Integration (Docs + Issues 중 최소 1종)
- `@modelcontextprotocol/sdk` 클라이언트로 MCP 서버 호출
  - `search_docs`: 문서 1~3개
  - (선택) `search_issues`: 이슈 0~2개
  - `search_posts`: 내부 포스트 semantic search
- AI Foundry semantic 결과 + MCP 결과를 하나의 JSON으로 결합
- Action Hint 생성 (템플릿 기반 또는 `gpt-4o-mini` 1줄 생성):
  - ex: "Docs 기반 해결 가능성이 높습니다 — Step 2를 먼저 확인하세요."
- 포스트 팝업에 "Suggested via MCP + Action Hint" 노출
- Graceful degrade: 전체 실패 → "No suggestions available", 부분 실패 → 성공 소스만 표시

### M6 (88–100m): Engagement + Demo Polish
- Interested/Join API (`POST /api/posts/{postId}/engagement`, 멱등 upsert)
- 참여자 수 UI 업데이트 (interestedCount, joinCount)
- 지도-검색 UI (검색창 + 필터 버튼 최소화)
- README에 MCP + AI Foundry 통합 흐름 설명
- 데모 리허설 1회 수행

## Scope Control (Cut List)

- 스킬 태그/카테고리 자동 분류
- 복잡한 Action Hint 생성 (LLM 고급 프롬프트 버전) → MVP는 템플릿 기반
- 포스트 히트맵/대시보드
- 고급 필터 UI (날짜 슬라이더, 고급 태그 선택)
- 스코어/랭킹/리포지션 시스템
- Available 참여 단계 (Interested/Join만 MVP 포함)
- 구조화된 로깅/모니터링 (console.log 수준만)
- 실시간 WebSocket 업데이트

## Deliverables

- Entra 로그인 후 지도 중심 인터페이스
- 포스트 생성 (3문장+TTL) → 지도 마커 반영
- AI Foundry semantic search 기반:
  - 유사 포스트 추천
  - 지도 검색 (검색 결과만 마커로 표시)
- MCP multi-source 결합: Docs(+Issues) 추천 + Action Hint
- Interested/Join
- 만료 제외
- 2분 데모 가능

## Project Structure

### Documentation (this feature)

```text
specs/001-map-first-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output — R1~R7 기술 리서치
├── data-model.md        # Phase 1 output — Post, Engagement, MCP 결과 스키마
├── quickstart.md        # Phase 1 output — 환경 설정 & 데모 스크립트
├── contracts/           # Phase 1 output — OpenAPI 3.1 스펙
│   └── openapi.yaml
├── checklists/
│   └── requirements.md  # Spec 품질 체크리스트
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
app/
├── layout.tsx            # Root layout (Auth provider, CSS imports)
├── page.tsx              # Main map page
├── api/
│   ├── auth/[...nextauth]/
│   │   └── route.ts      # Auth.js route handler
│   ├── posts/
│   │   └── route.ts      # GET (list) + POST (create) posts
│   ├── posts/[postId]/
│   │   ├── engagement/
│   │   │   └── route.ts  # POST engagement (upsert)
│   │   └── suggestions/
│   │       └── route.ts  # GET MCP+AI suggestions
│   └── search/
│       └── route.ts      # GET semantic map search
├── components/
│   ├── MapView.tsx        # Azure Maps wrapper (client component)
│   ├── PostMarker.tsx     # Map marker for posts
│   ├── PostPopup.tsx      # Popup with post details + MCP suggestions
│   ├── PostCreateModal.tsx # Post creation form (3-sentence + TTL)
│   ├── SearchBar.tsx      # Map search input
│   ├── SuggestionsPanel.tsx # "Suggested via MCP" UI
│   └── AuthButton.tsx     # Sign in / Sign out
├── lib/
│   ├── db.ts              # better-sqlite3 initialization
│   ├── auth.ts            # Auth.js config
│   ├── validation.ts      # 3-sentence validator (shared)
│   ├── mcp-client.ts      # MCP SDK client wrapper
│   ├── ai-foundry.ts      # Azure OpenAI embeddings + chat
│   └── cosine.ts          # Cosine similarity utility
└── types/
    └── index.ts           # Shared TypeScript types

mcp-server/
├── index.ts               # MCP server entry (Streamable HTTP)
├── tools/
│   ├── search-docs.ts     # search_docs tool
│   ├── search-issues.ts   # search_issues tool
│   ├── search-posts.ts    # search_posts tool (AI Foundry embeddings)
│   └── action-hint.ts     # generate_action_hint tool
└── data/
    ├── sample-docs.json   # Pre-embedded docs (MVP 하드코딩)
    └── sample-issues.json # Pre-embedded issues (MVP 하드코딩)

tests/
└── unit/
    ├── validation.test.ts # 3-sentence validation tests
    └── cosine.test.ts     # Cosine similarity tests
```

**Structure Decision**: Next.js App Router 단일 프로젝트 + MCP 서버 사이드카 구조.
프론트엔드/백엔드가 동일 Next.js 프로젝트 내 공존하며, MCP 서버만 별도 프로세스로 실행.
이 구조는 100분 타임박스에 최적화된 최소 복잡도를 제공한다.

## Complexity Tracking

> 7.2 Observability 원칙의 부분 준수만 이 섹션에서 정당화한다.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 7.2 Observability (PARTIAL) | 100분 타임박스에서 구조화 로깅 구현 불가 | console.log로 충분한 디버깅 가능, post-MVP에서 pino/winston 도입 예정 |
