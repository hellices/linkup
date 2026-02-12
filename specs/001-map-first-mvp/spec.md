# Feature Specification: LinkUp Map-First MVP Loop

**Feature Branch**: `001-map-first-mvp`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "LinkUp Map-First MVP — 3문장 포스트 + 지도 기반 탐색 + MCP 추천 + 협업 매칭을 100분 안에 빌드"

## Summary

LinkUp은 Entra ID로 로그인한 사용자가 3문장 이내의 짧은 포스트(질문/요청/링크)를
지도 위에 게시하고, MCP를 통해 관련 리소스를 추천받으며,
Interested/Join으로 협업을 시작할 수 있는 지도 기반 초경량 협업 앱의 MVP이다.
전체 흐름(로그인→포스트 생성→지도 반영→MCP 추천→Join→TTL 만료)을 2분 데모로 시연할 수 있어야 한다.

## Non-Goals (이번 MVP에서 제외)

- 실시간 위치 추적(친구 GPS), 팔로우/친구 그래프 등 무거운 소셜 기능
- 장문 게시, 위키/문서 저장소화
- 고급 추천(랭킹/정교한 ML), 완전한 스코어보드/대시보드
- 복잡한 권한 모델/조직도 기반 추천
- 백그라운드 DB 정리 작업(cleanup job), DB 수준 TTL 인덱스, 만료 포스트 자동 물리 삭제 — MVP에서는 조회 시점 필터링(`expiresAt > now`)만으로 충분하다
- 복잡한 인증 흐름: 토큰 자동 갱신(refresh), 세션 만료 재로그인 처리, 멀티탭 세션 동기화, 소셜 로그인 연동 등은 MVP 범위 밖이다

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Map Post Creation (Priority: P1)

사용자로서, Entra ID로 로그인한 뒤 지도 화면에서 "+" 버튼을 눌러
3문장 이내의 짧은 포스트를 작성하고, TTL(만료 시간)을 선택해 지도에 게시하고 싶다.
포스트는 지도 위의 특정 좌표(클릭 지점 또는 지도 중심점)에 마커로 표시된다.

**Why this priority**: 지도 위 포스트 생성은 LinkUp의 핵심 가치("10초 안에 질문")를
실현하는 최우선 기능이다. 이것이 없으면 다른 모든 기능이 무의미하다.

**Independent Test**: Entra 로그인 → "+" 버튼 → 3문장 작성 → TTL 선택 → 저장 →
지도에 새 마커 표시 확인. 이것만으로도 "지도 위에 질문을 올리는" 기본 가치를 제공한다.

**Acceptance Scenarios**:

1. **Given** 인증된 사용자가 지도 화면에 있을 때, **When** "+" 버튼을 누르고 3문장 이내 텍스트 + TTL을 입력하고 저장하면, **Then** 지도에 새 마커가 생성되고 해당 좌표에 표시된다.
2. **Given** 사용자가 포스트 작성 중일 때, **When** 4문장 이상 입력하면, **Then** UI에서 3문장 제한 안내가 표시되고 저장이 거부된다.
3. **Given** 사용자가 포스트 작성 모달을 열었을 때, **When** TTL 옵션(24h/72h/7d)을 선택하지 않으면, **Then** 저장 버튼이 비활성화되거나 기본 TTL이 적용된다.
4. **Given** 비인증 사용자(로그인 안 된 상태)일 때, **When** "+" 버튼을 누르면, **Then** 로그인 화면으로 리디렉션되거나 접근이 거부된다.

---

### User Story 2 — Map Discovery & Post Viewing (Priority: P1)

사용자로서, 지도를 탐색하며 주변/관심 영역에 게시된 포스트 마커를 클릭하면
팝업(또는 사이드 패널)에서 포스트 내용, 남은 시간, 참여 버튼, MCP 추천을 확인하고 싶다.

**Why this priority**: 포스트를 보는 것은 포스트 생성과 동등한 핵심 기능이다.
"어디에서 도움이 필요한지 직관적으로 이해"하는 Map-First 원칙의 직접 구현이다.

**Independent Test**: 기존 포스트가 있는 지도에서 마커 클릭 → 팝업에 포스트 요약,
남은 시간, Interested/Join 버튼, Suggested via MCP 섹션이 표시됨을 확인한다.

**Acceptance Scenarios**:

1. **Given** 지도에 1개 이상의 포스트 마커가 표시될 때, **When** 마커를 클릭하면, **Then** 팝업에 포스트 텍스트(3문장), 태그(있을 경우), 남은 TTL, 참여 버튼, MCP 추천 섹션이 표시된다.
2. **Given** 지도 뷰를 이동/줌할 때, **When** 새로운 영역에 포스트가 있으면, **Then** 해당 포스트의 마커가 지도에 로드되어 표시된다.

---

### User Story 3 — MCP + AI Foundry Integrated Search (Priority: P1)

사용자로서, 포스트 팝업에서 MCP + AI Foundry가 통합 검색한 관련 문서/이슈/포스트를
"Suggested via MCP" 라벨의 결합 UI에서 확인하고, 1줄 Action Hint(다음 행동 제안)를 받고 싶다.
또한 지도 검색 시 AI Foundry semantic search 결과가 지도 영역에 맞게 재필터링되어
마커로 표시되는 경험을 원한다.

**Why this priority**: MCP 통합은 Constitution에서 핵심 기능으로 정의되어 있으며,
AI Foundry와의 결합은 LinkUp이 단순 질문 게시판이 아닌 "지식 연결 플랫폼"임을
차별화하는 핵심이다. 다중 소스 결합 검색과 Action Hint는 Connection Over Storage 원칙의
직접 구현이다.

**Independent Test**:
- 포스트 팝업 열기 → "Suggested via MCP" 섹션에 Docs/Issues/Posts 결합 결과 표시 확인
- Action Hint 1줄이 결과 상단에 표시됨을 확인
- 지도 검색 시 semantic search 결과가 현재 뷰 영역 내 마커로 표시됨을 확인
- MCP 서버 장애 시 "No suggestions available" 표시를 확인

**Acceptance Scenarios**:

1. **Given** 사용자가 포스트 팝업을 열었을 때, **When** MCP + AI Foundry가 정상 응답하면, **Then** "Suggested via MCP" 섹션에 Docs/Issues/Posts 카테고리별로 결합된 결과가 표시된다.
2. **Given** MCP 결과가 반환되었을 때, **When** 결과 상단을 확인하면, **Then** 1줄 Action Hint(다음 행동 제안)가 표시된다.
3. **Given** 사용자가 지도에서 검색을 수행할 때, **When** AI Foundry semantic search 결과가 있으면, **Then** 현재 지도 뷰 영역 내의 결과만 마커로 표시된다.
4. **Given** 사용자가 포스트 팝업을 열었을 때, **When** MCP 호출이 실패하면, **Then** "No suggestions available" 메시지가 표시되고 앱은 정상 동작한다.

---

### User Story 4 — Collaboration Signal (Interested / Join) (Priority: P2)

사용자로서, 관심 있는 포스트에 "Interested" 또는 "Join"을 눌러 참여 의사를 표시하고,
참여자 수를 확인하고 싶다.

**Why this priority**: 협업 시작은 LinkUp의 "Connection Over Storage" 철학의 직접 구현이다.
P1(포스트/지도/MCP)이 없으면 참여 대상이 없으므로 P2로 분류한다.

**Independent Test**: 인증된 사용자가 포스트 팝업에서 "Join" 클릭 → 참여자 수 증가 확인.
동일 사용자가 다시 클릭 시 중복 카운트되지 않음을 확인.

**Acceptance Scenarios**:

1. **Given** 인증된 사용자가 포스트 팝업을 열었을 때, **When** "Interested" 또는 "Join" 버튼을 클릭하면, **Then** 참여가 기록되고 참여자 수가 업데이트된다.
2. **Given** 이미 "Join"을 누른 사용자가, **When** 다시 "Join"을 누르면, **Then** 중복 참여가 발생하지 않고 참여자 수는 변하지 않는다(멱등 처리).
3. **Given** 비인증 사용자가, **When** 참여 버튼을 클릭하면, **Then** 로그인이 요구된다.

---

### User Story 5 — TTL Expiration (Priority: P2)

사용자로서, TTL이 만료된 포스트가 자동으로 지도에서 사라져
부담 없이 가벼운 질문을 올릴 수 있는 경험을 제공받고 싶다.

**Why this priority**: Ephemeral by Default는 Constitution의 핵심 원칙이다.
MVP에서 만료 동작이 없으면 헌법 위반이므로 반드시 포함하되,
생성/조회/MCP보다 후순위로 구현 가능하다.

**Independent Test**: 짧은 TTL(예: 1분)의 포스트 생성 → 1분 후 지도 새로고침 →
해당 마커가 지도와 목록에서 사라짐을 확인.

**Acceptance Scenarios**:

1. **Given** TTL이 만료된 포스트가 존재할 때, **When** 지도를 로드하거나 새로고침하면, **Then** 해당 포스트의 마커는 표시되지 않는다.
2. **Given** 짧은 TTL(데모용)의 포스트를 생성한 후, **When** TTL 시간이 경과하면, **Then** 포스트 조회 요청에서 해당 포스트가 반환되지 않는다.

---

### User Story 6 — Entra ID Login (Priority: P1)

사용자로서, Entra ID로 간편하게 로그인하여 별도 회원가입 없이 바로 LinkUp을 사용하고 싶다.

**Why this priority**: 인증 없이는 어떤 쓰기 기능도 동작하지 않으므로
모든 기능의 전제 조건이다.

**Independent Test**: 앱 접근 → Entra ID 로그인 페이지 → 로그인 성공 → 지도 화면 진입.
로그인 실패 시 적절한 오류 메시지 표시.

**Acceptance Scenarios**:

1. **Given** 비인증 사용자가 앱에 접근할 때, **When** Entra ID 로그인을 완료하면, **Then** 지도 메인 화면에 진입하고 사용자 식별 정보가 세션에 유지된다.
2. **Given** 비인증 사용자가 앱에 접근할 때, **When** 로그인하지 않으면, **Then** 읽기 전용 모드로 지도를 볼 수 있다(지도 열람 + 마커 표시까지 허용). 포스트 상세 팝업, 포스트 생성, 참여(Interested/Join) 시도시에는 로그인 화면으로 안내된다.

---

### Edge Cases

- **3문장 경계**: 마침표/물음표/느낌표 기준 문장 카운트 시, 줄바꿈만 있는 경우나 URL 내 점(.)은 문장 구분으로 처리하지 않아야 한다.
- **TTL 동시성**: 포스트 팝업을 열고 있는 도중 TTL이 만료되면, 팝업은 닫히거나 "이 포스트는 만료되었습니다" 메시지를 표시해야 한다.
- **MCP 타임아웃**: MCP/AI Foundry 서버 응답이 느린 경우(예: 5초 이상), 추천 섹션에 로딩 표시 후 타임아웃 시 "No suggestions available" 표시.
- **MCP 부분 실패**: Docs는 성공하지만 Issues 소스가 실패한 경우, 성공한 소스의 결과만 표시하고 실패한 소스는 "unavailable" 표시.
- **Action Hint 생성 실패**: AI Foundry가 Action Hint를 생성하지 못하면, 힌트 영역을 숨기고 결과 목록만 표시.
- **Semantic search 결과와 지도 영역 불일치**: AI Foundry 결과 중 현재 지도 뷰 밖의 결과는 마커로 표시하지 않되, 결합 UI의 하단에 "지도 밖 N건" 라벨로 표시하고, 클릭 시 해당 영역으로 지도를 이동한다.
- **Semantic search 뷰포트 내 0건**: 검색 결과가 현재 지도 뷰포트 내에 0건이면, "이 영역에 검색 결과가 없습니다" 안내를 표시하고, 뷰포트 밖에 결과가 있으면 "지도 밖 N건" 표시로 안내한다.
- **중복 참여**: 동일 사용자의 Interested→Join 전환 시, 기존 Interested를 Join으로 업그레이드 처리하고 카운트가 중복 증가하지 않아야 한다.
- **좌표 없는 포스트**: 지도 클릭 없이 포스트 생성 시도 시, 기본 좌표(지도 중심점)를 자동 할당하거나 좌표 선택을 강제해야 한다.
- **빈 지도 영역**: 현재 지도 뷰에 포스트가 하나도 없을 때, 빈 상태 안내(예: "이 지역에는 아직 포스트가 없습니다")를 표시해야 한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 Entra ID를 통한 사용자 인증을 지원해야 한다.
- **FR-002**: 인증되지 않은 사용자의 쓰기 기능(포스트 생성, 참여)은 차단되어야 한다. MVP 인증 범위는 쓰기 경로 차단(write-path gating)에 한정하며, 읽기 경로(지도 열람)는 인증 없이 허용된다.
- **FR-003**: 메인 화면은 인터랙티브 지도 기반이어야 하며, 포스트는 마커로 표현되어야 한다.
- **FR-004**: 사용자는 "+" 버튼으로 포스트 작성 모달을 열 수 있어야 한다.
- **FR-005**: 포스트 본문은 3문장 이내로 제한되어야 하며, 이 제한은 UI와 서버 모두에서 강제되어야 한다.
- **FR-006**: 포스트는 TTL(만료 시간)을 필수로 가져야 하며, 사용자가 선택하거나 기본값이 적용되어야 한다.
- **FR-007**: 포스트는 위도/경도 좌표를 필수로 가져야 한다. MVP에서는 지도 클릭 지점 또는 지도 중심점을 좌표로 사용한다.
- **FR-008**: 마커 클릭 시 팝업(또는 사이드 패널)에 포스트 요약, 남은 시간, 참여 버튼, MCP 추천 섹션이 표시되어야 한다.
- **FR-009**: 사용자는 포스트에 대해 "Interested" 또는 "Join"을 표시할 수 있어야 한다.
- **FR-010**: 동일 사용자의 중복 참여는 멱등 처리되어야 한다(한 번만 카운트).
- **FR-011**: 포스트 팝업에 참여자 수(Interested/Join)가 표시되어야 한다.
- **FR-012**: TTL이 만료된 포스트는 지도 및 조회 결과에서 제외되어야 한다. MVP에서 TTL 강제는 조회 시점 필터링(`expiresAt > now`)으로 충분하며, 만료 포스트는 조회 결과에서 제외되지만 DB에서 물리적으로 삭제되지는 않는다(물리 삭제는 Non-Goals 참조).
- **FR-013** (FR7.1): MCP는 외부 데이터 소스(Docs + Issues 중 최소 1종)를 연동해 검색 결과를 제공해야 한다.
- **FR-014** (FR7.2): 포스트 작성/조회 시 AI Foundry + MCP를 사용해 "연관도 높은 포스트/문서/이슈"를 반환해야 한다.
- **FR-015** (FR7.3): 지도 검색에서 AI Foundry semantic search 결과를 현재 지도 뷰 영역으로 재필터링하여 마커로 표시해야 한다. 검색 활성화 시 검색 결과에 해당하는 마커는 강조(highlight) 표시하고, 결과에 해당하지 않는 마커는 흐리게(dimmed/reduced opacity) 처리하여 시각적으로 구분한다. 검색 결과 마커는 색상 변화 또는 크기 변화로 일반 마커와 명확히 구별되어야 한다.
- **FR-016** (FR7.4): MCP 결과를 기반으로 "Action Hint(다음 행동 제안)"을 1줄 생성해 사용자에게 제공해야 한다. Action Hint는 포스트 팝업의 "Suggested via MCP" 섹션 상단에 강조된 스타일(배경색 또는 볼드)로 배치되며, 일반 요약이 아닌 구체적인 다음 행동을 제안해야 한다(예: "Step 2를 먼저 확인하세요", "관련 이슈 #42를 참고하세요"). Action Hint는 클릭 가능하며, 클릭 시 해당 리소스로 이동할 수 있어야 한다.
- **FR-017** (FR7.5): 여러 결과(Docs + Posts + Issues)를 하나의 결합된 UI에 카테고리별로 그룹화하여 표시해야 한다("Suggested via MCP" 라벨 포함). 결과는 평면 목록이 아닌 소스 카테고리(Docs / Issues / Posts)별로 구분된 섹션으로 표시되어 다중 소스 통합이 시각적으로 명확해야 한다.
- **FR-018**: MCP 호출 실패 시 "No suggestions available" 메시지로 graceful degrade 해야 하며, 부분 실패 시 성공한 소스의 결과만 카테고리별로 표시하고 실패한 소스 카테고리는 해당 섹션에 "unavailable" 상태를 명시해야 한다(예: Docs 성공 + Issues 실패 → Docs 결과 정상 표시 + Issues 섹션에 "Issues unavailable" 표시).
- **FR-019**: 포스트 본문, PII, 민감 데이터는 로그에 원문 그대로 기록하지 않아야 한다.
- **FR-020**: 입력 값(본문 길이, 문장 수, 좌표 범위)에 대한 서버 측 검증이 수행되어야 한다.
- **FR-021**: 포스트 팝업에는 최소 2개의 서로 구분되는 MCP UI 요소가 표시되어야 한다: ① "Suggested via MCP" 라벨이 붙은 카테고리별 결과 목록(FR-017), ② 결과 상단의 강조된 Action Hint 1줄(FR-016). 이 두 요소는 시각적으로 명확히 구분되어야 한다.
- **FR-022**: 지도에서 semantic search 수행 시 현재 뷰포트 내에 결과가 0건이면, "이 영역에 검색 결과가 없습니다" 안내와 함께 "지도 밖 N건" 표시를 제공해야 한다. 사용자는 해당 표시를 통해 뷰포트 밖의 결과가 존재함을 인지하고, 클릭 시 해당 영역으로 지도가 이동할 수 있어야 한다.

### Key Entities

- **Post**: 지도 위에 게시되는 3문장 이내의 짧은 질문/요청/링크. 작성자 ID, 본문, 태그(선택), 좌표(위도/경도), 모드(online/offline/both, 선택), 생성 시각, 만료 시각을 포함한다.
- **Engagement**: 사용자가 특정 포스트에 보낸 참여 신호. 포스트 ID, 사용자 ID, 참여 의도(interested/join), 생성 시각을 포함한다. 동일 사용자-포스트 조합에 대해 하나만 존재한다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 사용자가 로그인부터 포스트 생성까지 30초 이내에 완료할 수 있다.
- **SC-002**: 사용자가 마커 클릭부터 MCP 결합 검색 결과(Docs+Posts+Issues) 및 Action Hint 확인까지 5초 이내에 완료할 수 있다.
- **SC-003**: 전체 데모 흐름(로그인→포스트 생성→MCP 추천+Action Hint 확인→Join→TTL 만료 확인→검색으로 마커 필터링)을 2분 이내에 시연할 수 있다(Demo Script 6단계 참조).
- **SC-004**: 3문장 초과 입력 시 100%의 경우 UI와 서버 양쪽에서 거부된다.
- **SC-005**: TTL 만료 후 해당 포스트가 지도와 조회 결과에서 100% 제외된다.
- **SC-006**: MCP/AI Foundry 서버 장애 시에도 앱의 나머지 기능(포스트 생성/조회/참여)이 정상 동작한다.
- **SC-008**: MCP 결합 검색 결과에 최소 2개 소스 카테고리(Docs+Posts 또는 Docs+Issues)가 포함된다.
- **SC-009**: 지도 검색 시 AI Foundry semantic search 결과가 현재 지도 뷰 영역 내 마커로 표시되며, 검색 결과 마커는 강조 표시(색상/크기 변화)로 일반 마커와 시각적으로 구분되고, 결과 외 마커는 흐리게(dimmed) 처리된다.
- **SC-007**: 동일 사용자의 중복 참여가 100% 멱등 처리되어 카운트가 정확하다.

## Assumptions

- MVP 대상 사용자는 이미 Entra ID 계정을 보유한 내부 직원(CSA/SE/SA 등)이다.
- 사용자의 실시간 GPS 위치는 사용하지 않으며, 좌표는 지도 클릭/중심점으로 결정한다.
- TTL 옵션은 24시간 / 72시간 / 7일 중 선택하며, 데모용으로 짧은 TTL(1~5분)도 지원한다.
- TTL 데모 단계(짧은 TTL 만료 확인)는 조회 시점 필터링(`expiresAt > now`)만으로 달성 가능하며, 실시간 push/WebSocket은 불필요하다. 사용자가 지도를 새로고침하면 만료 포스트가 마커에서 사라진다.
- MCP 서버는 외부 데이터 소스(Docs + Issues) 중 최소 1종을 연동하며, AI Foundry를 통해 semantic search와 Action Hint 생성을 수행한다.
- AI Foundry 연동은 Azure AI Foundry SDK 또는 REST API를 통해 이루어지며, 모델 선택은 plan 단계에서 결정한다.
- 팝업 참여 버튼은 최대 2개(Interested/Join)이며, 추가 액션(채팅/미팅)은 후속 spec에서 다룬다.
- 읽기 전용 모드(비인증 사용자)의 범위는 지도 열람 + 마커 표시까지 허용하고, 포스트 상세 팝업은 인증 후 접근을 기본으로 한다.
- MVP 인증 합격 기준: ① Entra ID 로그인 성공, ② 세션 유지(persistence) — 로그인 후 새로고침해도 세션 유지, ③ 쓰기 경로 차단(write guard) — 비인증 사용자의 포스트 생성/참여 차단. 이 3가지가 동작하면 MVP 인증은 합격이다.

## UX Guidelines (Zenly-light)

- 메인 화면은 "지도 1스크린 + 플로팅 + 버튼" 패턴을 유지한다.
- 팝업은 최대 1~2개의 행동 버튼만 제공한다(가벼움 유지).
- 색상/아이콘은 가벼운 톤(파스텔/미니멀)으로 구성한다.
- 2분 데모 스크립트가 자연스럽게 진행되도록 동선을 단순화한다.

## Safety & Reliability (MVP Baseline)

- 입력 검증: 본문 길이/문장 수/좌표 범위/URL 형식 검증을 수행한다.
- 레이트 리밋(간단) 또는 최소한의 남용 방지를 적용한다.
- 로그 마스킹: 사용자 입력 원문을 로그에 남기지 않는다.
- MCP 등 외부 호출은 타임아웃/실패 처리를 포함한다.

## Demo Script (2 minutes)

> **홈든 시나리오**: 로그인 → 지도 → 포스트 작성 → 팝업에서 MCP 추천/Action Hint → Join → 검색으로 필터링
> **Fallback**: MCP/AI Foundry 장애 시 → 팝업에 "No suggestions available" 표시 후 Step 4(Join)로 진행. 각 단계는 독립적으로 진행 가능하며, 이전 단계 실패가 다음 단계를 차단하지 않는다.

1. **Entra ID 로그인** — 로그인 성공 → 지도 메인 화면 진입 (핸드오프: 세션 생성 확인)
2. **포스트 생성** — 지도 중심점에서 "+" 버튼 → 3문장 포스트 작성 + TTL 선택 → 저장 (핸드오프: 지도에 새 마커 표시 확인)
3. **MCP 추천 + Action Hint 확인** — 새 마커 클릭 → 팝업에서 ① Action Hint 1줄(강조 스타일) 확인, ② "Suggested via MCP" 카테고리별(Docs/Issues/Posts) 결과 확인 (핸드오프: MCP 실패 시 "No suggestions available" 표시 후 Step 4로 진행)
4. **Join** — "Join" 클릭 → 참여자 수 증가 확인 (핸드오프: 참여 기록 완료)
5. **TTL 만료** — (데모용 짧은 TTL) 포스트 만료 후 지도 새로고침 → 마커 사라짐 확인. 조회 시점 필터링만으로 동작하며 실시간 push/WebSocket은 불필요 (핸드오프: 마커 제거 확인)
6. **검색으로 마커 필터링** — 검색어 입력 → AI Foundry semantic search → 검색 결과 마커 강조 + 나머지 마커 흐리게 처리 확인 (핸드오프: 시각적 구분 확인)
