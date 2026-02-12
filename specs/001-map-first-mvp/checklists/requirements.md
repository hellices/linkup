# Specification Quality Checklist: LinkUp Map-First MVP Loop

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-02-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] CHK001 No implementation details (languages, frameworks, APIs)
- [x] CHK002 Focused on user value and business needs
- [x] CHK003 Written for non-technical stakeholders
- [x] CHK004 All mandatory sections completed

## Requirement Completeness

- [x] CHK005 No [NEEDS CLARIFICATION] markers remain
- [x] CHK006 Requirements are testable and unambiguous
- [x] CHK007 Success criteria are measurable
- [x] CHK008 Success criteria are technology-agnostic (no implementation details)
- [x] CHK009 All acceptance scenarios are defined
- [x] CHK010 Edge cases are identified
- [x] CHK011 Scope is clearly bounded (Non-Goals section present)
- [x] CHK012 Dependencies and assumptions identified

## Feature Readiness

- [x] CHK013 All functional requirements have clear acceptance criteria
- [x] CHK014 User scenarios cover primary flows
- [x] CHK015 Feature meets measurable outcomes defined in Success Criteria
- [x] CHK016 No implementation details leak into specification

---

## Pre-Flight: E2E Demo Flow Completeness

> **목표**: "로그인 → 지도 → 포스트 작성 → 팝업에서 MCP 추천/Action Hint → Join → 검색으로 필터링" 이 한 줄이 막힘 없이 시연 가능한가?

- [x] CHK017 - Does the Demo Script include ALL 6 steps of the target flow (로그인→지도→포스트→MCP+Action Hint→Join→**검색 필터링**)? Current script has 5 steps and omits semantic search filtering. [Completeness, Gap, Spec §Demo Script]
- [x] CHK018 - Are handoff points between each demo step explicitly defined so no step blocks the next? (e.g., MCP failure must not block Join) [Clarity, Gap]
- [x] CHK019 - Does SC-003 ("2분 데모") reference the complete 6-step flow, or only the current 5-step script? [Consistency, Spec §SC-003 vs §Demo Script]
- [x] CHK020 - Is a fallback path defined if MCP/AI Foundry is unavailable mid-demo? (e.g., skip to Join step) [Coverage, Edge Case, Spec §FR-018]
- [x] CHK021 - Does the Demo Script explicitly mention Action Hint visibility in step 3? Current wording says "Suggested via MCP 리소스 확인" but omits Action Hint. [Completeness, Spec §Demo Script step 3 vs §FR-016]

## Pre-Flight: MCP as Visible Feature (≥2 UI Touchpoints)

> **목표**: MCP가 "장식"이 아니라 "기능"처럼 보이려면 최소 2가지 UI가 필요 — ① Suggested via MCP (추천 링크) ② Action Hint (다음 행동 1줄)

- [x] CHK022 - Are at least 2 distinct, user-visible MCP UI elements specified? (① "Suggested via MCP" label with categorized links, ② Action Hint 1-line) [Completeness, Spec §FR-016, §FR-017]
- [x] CHK023 - Is the Action Hint format specified clearly enough to be distinguishable from decorative text? (placement, styling, actionability) [Clarity, Spec §FR-016]
- [x] CHK024 - Is the "Suggested via MCP" label required to show categorized results (Docs/Issues/Posts) rather than a flat list, making multi-source integration visually obvious? [Clarity, Spec §FR-017]
- [x] CHK025 - Are requirements defined for Action Hint to suggest a concrete *next action* (e.g., "Step 2를 먼저 확인하세요") rather than a generic summary? [Measurability, Spec §FR-016]
- [x] CHK026 - Is the partial-failure UX specified per source category? (e.g., Docs succeeds but Issues fails → show Docs + "Issues unavailable") [Consistency, Spec §FR-018]

## Pre-Flight: AI Foundry Search → Map Reflection

> **목표**: 검색어 입력 → semantic 결과 → 지도에서 마커가 줄어들거나 강조되어야 함 (없으면 AI Foundry가 "백엔드만 있는 느낌")

- [x] CHK027 - Is the search→map visual feedback explicitly specified? (markers reduced, highlighted, or filtered — which behavior?) [Clarity, Spec §FR-015]
- [x] CHK028 - Are requirements for visual differentiation between search-result markers and regular markers defined? (color, size, animation, opacity) [Gap, Spec §FR-015]
- [x] CHK029 - Is the behavior specified when semantic search returns zero matches in the current viewport? (empty state vs zoom-out prompt) [Edge Case, Spec §Edge Cases]
- [x] CHK030 - Does the spec define the "지도 밖 N건" indicator for out-of-viewport semantic results? [Completeness, Spec §Edge Cases — "지도 밖" 라벨]
- [x] CHK031 - Can "검색 결과가 지도에 반영" be objectively verified? Are specific visual criteria defined? [Measurability, Spec §SC-009]

## Pre-Flight: TTL — MVP Scope Clarity

> **목표**: 100분 MVP에서는 만료된 포스트를 GET에서 제외하는 필터링만으로 충분 (DB 삭제/TTL 설정은 나중에)

- [x] CHK032 - Does the spec explicitly state that TTL enforcement via query-time filtering (`expiresAt > now`) is sufficient for MVP? [Clarity, Spec §FR-012]
- [x] CHK033 - Is the distinction between "excluded from query results" vs "physically deleted from database" clearly scoped for MVP? [Scope, Gap]
- [x] CHK034 - Are background cleanup jobs / DB-level TTL indices explicitly listed as Non-Goals or deferred scope? [Completeness, Spec §Non-Goals]
- [x] CHK035 - Is the TTL demo step (짧은 TTL 만료 확인) achievable with query-time filtering alone, without requiring real-time push/WebSocket? [Consistency, Spec §Demo Script step 5 vs §Scope Control]

## Pre-Flight: Auth — MVP Scope Clarity

> **목표**: Entra 로그인은 연결만 되면 되고, 미로그인 시 Create/Join을 막는 것만으로도 MVP 기준 합격

- [x] CHK036 - Does the spec scope auth requirements to write-path gating only (Create + Join blocked for unauthenticated)? [Scope, Spec §FR-002]
- [x] CHK037 - Is the read-only mode for unauthenticated users clearly defined? (지도 열람만 허용 vs 포스트 팝업도 허용) [Clarity, Spec §US6 Acceptance 2, §Assumptions]
- [x] CHK038 - Are complex auth flows (token refresh, session expiry, multi-tab) explicitly excluded from MVP scope? [Scope, Gap]
- [x] CHK039 - Is "Entra ID 연결만 되면 충분" quantified? (e.g., login + session persistence + write guard = pass criteria) [Measurability, Gap]

---

## Notes

- CHK001–CHK016: Spec quality baseline (all passed).
- **CHK017–CHK039: Pre-flight implementation readiness checklist (all passed after spec update).**
- Resolved gaps:
  - Demo Script expanded to 6 steps with handoff points, fallback path, and Action Hint in step 3.
  - SC-003 updated to reference complete 6-step flow.
  - FR-015 now specifies highlight/dimmed visual feedback for search→map.
  - FR-016 now specifies Action Hint placement (top of MCP section), styling (bold/background), actionability (clickable), and concrete next-action format.
  - FR-017 now requires categorized (Docs/Issues/Posts) display, not flat list.
  - FR-018 now specifies per-category partial-failure UX.
  - FR-021/FR-022 added for MCP UI visibility (≥2 elements) and zero-match/"지도 밖 N건" behavior.
  - FR-012 explicitly states query-time filtering for MVP; physical deletion listed in Non-Goals.
  - FR-002 explicitly scopes to write-path gating; complex auth flows listed in Non-Goals.
  - US6 Acceptance 2 clarifies read-only mode (map + markers, popup requires auth).
  - Assumptions quantify MVP auth pass criteria (login + session + write guard).
  - SC-009 defines specific visual criteria (highlight + dimmed).
- The spec references "Azure Maps" and "Entra ID" by name — these are product/service names
  (not implementation details) and are acceptable because they define *what* the system
  integrates with, not *how* it is built.
- "MCP" is referenced as a protocol/capability requirement, not an implementation choice.
