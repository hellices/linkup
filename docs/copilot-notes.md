# GitHub Copilot Usage Records — LinkUp MVP

## Usage Summary

GitHub Copilot (Claude Opus 4.6)을 사용하여 LinkUp Map-First MVP를 구현했습니다.

---

## Case 1: Specification Quality Validation & Gap Resolution

**Context**: spec.md에 23개의 미완료 pre-flight 체크리스트 항목이 있었음

**How Copilot helped**:
- 체크리스트 항목(CHK017–CHK039)별 gap 분석
- spec.md에 누락된 내용 자동 보완:
  - Demo Script 5단계 → 6단계 확장 (검색 필터링 추가)
  - FR-015에 search→map 시각적 피드백 명세 추가
  - FR-016에 Action Hint 배치/스타일/클릭 동작 명세 추가
  - Non-Goals에 TTL 물리 삭제, 복잡한 인증 흐름 추가
  - Assumptions에 MVP 인증 합격 기준 정량화

**Impact**: 23개 항목 일괄 해결, spec 품질 39/39 달성

---

## Case 2: Full-Stack Project Scaffolding

**Context**: 빈 디렉토리에서 Next.js 14 + TypeScript + Tailwind 프로젝트 구성 필요

**How Copilot helped**:
- package.json, tsconfig.json, tailwind.config.js, postcss.config.js 생성
- 47개 task 기반 전체 소스 코드 생성:
  - Auth.js v5 + Entra ID 인증 (auth.ts, middleware.ts, AuthButton)
  - Azure Maps 지도 컴포넌트 (MapView with markers + dimmed states)
  - SQLite DB 초기화 (better-sqlite3, posts + engagements tables)
  - 3문장 검증 유틸리티 (URL/ellipsis 제외 로직)
  - MCP 서버 (4 tools: search_docs, search_issues, search_posts, action_hint)
  - AI Foundry 클라이언트 (embeddings + chat completions)

**Impact**: 12개 소스 파일 + 4개 API 라우트 + MCP 서버 일괄 생성

---

## Case 3: MCP Multi-Source Integration with Graceful Degrade

**Context**: FR-018 요구사항 — 부분 실패 시 성공 소스만 표시, 전체 실패 시 메시지 표시

**How Copilot helped**:
- MCP 클라이언트에서 `Promise.allSettled()` 패턴으로 개별 소스 독립 처리
- 각 소스별 실패를 `unavailableSources` 배열로 추적
- SuggestionsPanel에서 카테고리별 "unavailable" 상태 UI 렌더링 구현
- Action Hint 생성 실패 시 힌트 영역 숨김 처리

**Impact**: FR-018 부분 실패 UX 완전 구현 (per-category graceful degrade)
