# Data Model: LinkUp Map-First MVP + AI Foundry + MCP

**Feature**: `001-map-first-mvp`
**Date**: 2026-02-12 (Updated: 2026-02-12)

## Entities

### Post

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string (UUID v4) | PK, NOT NULL | 포스트 고유 식별자 |
| authorId | string | NOT NULL | Entra ID 사용자 식별자 (OID) |
| authorName | string | NOT NULL | 표시용 사용자 이름 (세션에서 추출) |
| text | string | NOT NULL, max 500 chars, ≤ 3 sentences | 포스트 본문 (3문장 제한) |
| tags | string[] | optional, max 5 tags | 태그 목록 (예: "AKS", "Entra") |
| lat | number (float) | NOT NULL, -90 ≤ lat ≤ 90 | 위도 |
| lng | number (float) | NOT NULL, -180 ≤ lng ≤ 180 | 경도 |
| mode | enum(online, offline, both) | optional, default: "both" | 협업 모드 |
| createdAt | datetime (ISO 8601) | NOT NULL, server-set | 생성 시각 |
| expiresAt | datetime (ISO 8601) | NOT NULL | 만료 시각 (TTL 기반 계산) |

**Validation Rules**:
- `text`: 3문장 이내. 문장은 `.`, `?`, `!` 기준으로 카운트하되, URL 내 dots와 ellipsis(`...`)는 제외
- `expiresAt`: `createdAt`보다 미래여야 함. TTL 옵션: 24h / 72h / 7d / 1min(데모용)
- `tags`: 각 태그는 20자 이내, 최대 5개
- `lat`/`lng`: 유효한 좌표 범위 내

**State Transitions**:
- `active` → `expired`: `expiresAt < now()` 조건 충족 시 자동 전환 (조회 시 필터링)

### Engagement

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| postId | string (UUID) | NOT NULL, FK → Post.id | 대상 포스트 |
| userId | string | NOT NULL | 참여자의 Entra ID OID |
| intent | enum(interested, join) | NOT NULL | 참여 의도 |
| createdAt | datetime (ISO 8601) | NOT NULL, server-set | 참여 시각 |

**Uniqueness**: `(postId, userId)` — 동일 사용자-포스트 조합은 하나만 존재.
Interested → Join으로 업그레이드 시 기존 레코드의 `intent` 필드를 UPDATE (INSERT OR REPLACE).

**Validation Rules**:
- `intent`: "interested" 또는 "join"만 허용
- `postId`: 존재하는, 만료되지 않은 포스트여야 함
- `userId`: 인증된 사용자만 생성 가능

### PostEmbedding (인메모리)

> SQLite에 저장하지 않고 런타임 인메모리 캐시로 관리한다. 프로세스 재시작 시 재생성.

| Field | Type | Description |
|-------|------|-------------|
| postId | string (UUID) | 대상 포스트 ID |
| vector | number[] (1536 dims) | `text-embedding-3-small` 임베딩 벡터 |
| text | string | 원본 포스트 텍스트 (cosine similarity 결과 표시용) |

**생성 시점**: 포스트 생성 시 비동기로 임베딩 생성 → 캐시 저장
**만료**: 포스트 TTL 만료 시 캐시에서도 제거

### MCP Combined Result (API 응답 전용, 비저장)

> DB에 저장하지 않는 런타임 데이터 구조. API 응답으로만 사용.

| Field | Type | Description |
|-------|------|-------------|
| docs | McpSuggestion[] | MCP `search_docs` 결과 (0~3개) |
| issues | McpSuggestion[] | MCP `search_issues` 결과 (0~2개) |
| posts | PostSummary[] | AI Foundry semantic search 결과 (0~5개) |
| actionHint | string \| null | Action Hint 1줄 (생성 실패 시 null) |
| source | "mcp" | 항상 "mcp" — UI 라벨 표시용 |

### McpSuggestion (개별 추천 항목)

| Field | Type | Description |
|-------|------|-------------|
| title | string | 리소스 제목 |
| url | string (URI) | 리소스 링크 |
| description | string | 1줄 요약 |
| sourceType | "doc" \| "issue" \| "post" | 소스 카테고리 |
| status | "available" \| "unavailable" | 소스 조회 성공 여부 |

### SemanticSearchResult (지도 검색 응답, 비저장)

> 지도 검색 시 AI Foundry semantic search + bbox 재필터링 결과.

| Field | Type | Description |
|-------|------|-------------|
| posts | PostSummary[] | bbox 필터링된 semantic search 결과 |
| outOfBounds | number | bbox 밖의 결과 개수 (UI에서 "지도 밖 N건" 표시) |
| query | string | 검색 쿼리 원문 |

## Relationships

```text
Post 1 ──── * Engagement
  │                │
  │ authorId       │ userId
  │                │
  └── (Entra ID User: not stored as entity, resolved from session)

Post 1 ──── 0..1 PostEmbedding  (인메모리 캐시, 비동기 생성)

MCP Combined Result (런타임 조합):
  ├── docs[]     ← MCP search_docs
  ├── issues[]   ← MCP search_issues
  ├── posts[]    ← AI Foundry semantic search (PostSummary[])
  └── actionHint ← gpt-4o-mini 또는 템플릿
```

- 1 Post → N Engagements (한 포스트에 여러 사용자가 참여)
- 1 User → N Engagements (한 사용자가 여러 포스트에 참여)
- 1 User → N Posts (한 사용자가 여러 포스트 작성)
- 1 Post → 0..1 PostEmbedding (임베딩 생성 전/실패 시 없을 수 있음)
- MCP Combined Result는 요청 시 동적 생성, 저장하지 않음

## Aggregated Views

### Post with Engagement Counts (for popup display)

| Derived Field | Computation |
|---------------|-------------|
| interestedCount | COUNT(Engagement WHERE postId = ? AND intent = 'interested') |
| joinCount | COUNT(Engagement WHERE postId = ? AND intent = 'join') |
| currentUserIntent | Engagement.intent WHERE postId = ? AND userId = currentUser (nullable) |
| timeRemaining | expiresAt - now() |

## SQLite Schema (Implementation Reference)

```sql
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  authorId TEXT NOT NULL,
  authorName TEXT NOT NULL,
  text TEXT NOT NULL,
  tags TEXT,  -- JSON array stored as text
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  mode TEXT DEFAULT 'both',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  expiresAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS engagements (
  postId TEXT NOT NULL,
  userId TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('interested', 'join')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (postId, userId),
  FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_expires ON posts(expiresAt);
CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(lat, lng);
```
