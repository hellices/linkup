# Feature Specification: LinkUp Map-First MVP Loop

**Feature Branch**: `001-map-first-mvp`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "LinkUp Map-First MVP — 3-sentence posts + map-based discovery + MCP recommendations + collaboration matching built in 100 minutes"

## Summary

LinkUp is an MVP of a map-based ultra-lightweight collaboration app where users logged in via Entra ID
can post short posts (questions/requests/links) of up to 3 sentences on a map,
receive related resource recommendations through MCP,
and start collaboration via Interested/Join.
The entire flow (login → post creation → map update → MCP recommendations → Join → TTL expiration) must be demonstrable in a 2-minute demo.

## Non-Goals (Excluded from this MVP)

- Heavy social features such as real-time location tracking (friend GPS), follow/friend graphs, etc.
- Long-form posting, wiki/document repository features
- Advanced recommendations (ranking/sophisticated ML), full scoreboard/dashboard
- Complex permission models/org chart-based recommendations
- Background DB cleanup jobs, DB-level TTL indexes, automatic physical deletion of expired posts — in the MVP, query-time filtering (`expiresAt > now`) is sufficient
- Complex authentication flows: automatic token refresh, session expiration re-login handling, multi-tab session synchronization, social login integration, etc. are outside the MVP scope

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Map Post Creation (Priority: P1)

As a user, after logging in with Entra ID, I want to press the "+" button on the map screen
to write a short post of up to 3 sentences, select a TTL (expiration time), and publish it on the map.
The post is displayed as a marker at specific coordinates on the map (click point or map center).

**Why this priority**: Map post creation is the top-priority feature that realizes LinkUp's core value
("ask a question in 10 seconds"). Without this, all other features are meaningless.

**Independent Test**: Entra login → "+" button → write 3 sentences → select TTL → save →
verify new marker appears on the map. This alone delivers the basic value of "posting a question on the map."

**Acceptance Scenarios**:

1. **Given** an authenticated user is on the map screen, **When** they press the "+" button, enter text of up to 3 sentences + TTL, and save, **Then** a new marker is created on the map and displayed at the corresponding coordinates.
2. **Given** a user is writing a post, **When** they enter 4 or more sentences, **Then** a 3-sentence limit notice is displayed in the UI and the save is rejected.
3. **Given** a user has opened the post creation modal, **When** they do not select a TTL option (24h/72h/7d), **Then** the save button is disabled or a default TTL is applied.
4. **Given** an unauthenticated user (not logged in), **When** they press the "+" button, **Then** they are redirected to the login screen or access is denied.

---

### User Story 2 — Map Discovery & Post Viewing (Priority: P1)

As a user, I want to explore the map, click on post markers in nearby/areas of interest,
and view the post content, remaining time, engagement buttons, and MCP recommendations
in a popup (or side panel).

**Why this priority**: Viewing posts is a core feature on par with post creation.
It is a direct implementation of the Map-First principle: "intuitively understand where help is needed."

**Independent Test**: On a map with existing posts, click a marker → verify the popup shows
post summary, remaining time, Interested/Join buttons, and Suggested via MCP section.

**Acceptance Scenarios**:

1. **Given** one or more post markers are displayed on the map, **When** a marker is clicked, **Then** the popup shows the post text (3 sentences), tags (if any), remaining TTL, engagement buttons, and MCP recommendation section.
2. **Given** the map view is panned/zoomed, **When** there are posts in the new area, **Then** the markers for those posts are loaded and displayed on the map.

---

### User Story 3 — MCP + AI Foundry Integrated Search (Priority: P1)

As a user, I want to view **M365 internal resources (OneDrive files/PPT, SharePoint documents, Outlook emails) with priority**,
along with supplementary external resources (Azure Docs, GitHub Issues) and similar posts
via MCP + AI Foundry integrated search in a combined UI labeled "Suggested via MCP,"
and receive a 1-line Action Hint (next action suggestion).
Additionally, when searching the map, I want AI Foundry semantic search results to be re-filtered
to the map area and displayed as markers.

**Why this priority**: MCP integration is defined as a core feature in the Constitution,
and the combination with AI Foundry is the key differentiator that makes LinkUp
a "knowledge connection platform" rather than a simple question board.
**M365 internal resource search is the core value** — PPTs, OneDrive files,
SharePoint documents, and emails that I already have are practically more useful than documents found on the internet. External web search (Docs/Issues) plays a supplementary role.
Multi-source combined search and Action Hints are a direct implementation of the Connection Over Storage principle.

**Independent Test**:
- Open post popup → verify M365 results (OneDrive/SharePoint/Email) displayed **prominently** at the top of the "Suggested via MCP" section
- Verify supplementary web results (Docs/Issues) displayed below M365 results
- Verify combined Posts results in the "Suggested via MCP" section
- Verify a 1-line Action Hint is displayed at the top of the results
- Verify that semantic search results are displayed as markers within the current map view area during map search
- Verify "No suggestions available" is displayed when the MCP server fails

**Acceptance Scenarios**:

1. **Given** a user has opened a post popup, **When** MCP + AI Foundry responds successfully, **Then** combined results grouped by category are displayed in the "Suggested via MCP" section, with **M365 sources (OneDrive/SharePoint/Email) displayed first** as primary results, followed by supplementary web sources (Docs/Issues) and related Posts.
2. **Given** MCP results have been returned, **When** the top of the results is viewed, **Then** a 1-line Action Hint (next action suggestion) is displayed.
3. **Given** a user performs a search on the map, **When** AI Foundry semantic search results exist, **Then** only results within the current map view area are displayed as markers.
4. **Given** a user has opened a post popup, **When** the MCP call fails, **Then** a "No suggestions available" message is displayed and the app continues to function normally.
5. **Given** a user has opened a post popup, **When** M365 sources return results but web sources fail, **Then** M365 results are displayed normally and web source sections show "unavailable" status.

---

### User Story 4 — Collaboration Signal (Interested / Join) (Priority: P2)

As a user, I want to press "Interested" or "Join" on a post of interest to signal my participation intent,
and view the participant count.

**Why this priority**: Starting collaboration is a direct implementation of LinkUp's "Connection Over Storage" philosophy.
Without P1 (posts/map/MCP), there is nothing to participate in, so this is classified as P2.

**Independent Test**: Authenticated user clicks "Join" in the post popup → verify participant count increases.
Verify that clicking again by the same user does not result in a duplicate count.

**Acceptance Scenarios**:

1. **Given** an authenticated user has opened a post popup, **When** they click the "Interested" or "Join" button, **Then** the engagement is recorded and the participant count is updated.
2. **Given** a user who has already pressed "Join," **When** they press "Join" again, **Then** no duplicate engagement occurs and the participant count does not change (idempotent handling).
3. **Given** an unauthenticated user, **When** they click the engagement button, **Then** login is required.

---

### User Story 5 — TTL Expiration (Priority: P2)

As a user, I want posts with expired TTLs to automatically disappear from the map,
providing a low-pressure experience for posting lightweight questions.

**Why this priority**: Ephemeral by Default is a core principle of the Constitution.
Without expiration behavior in the MVP, it violates the constitution, so it must be included,
but it can be implemented after creation/viewing/MCP.

**Independent Test**: Create a post with a short TTL (e.g., 1 minute) → refresh the map after 1 minute →
verify the marker disappears from the map and list.

**Acceptance Scenarios**:

1. **Given** a post with an expired TTL exists, **When** the map is loaded or refreshed, **Then** the marker for that post is not displayed.
2. **Given** a post with a short TTL (for demo) has been created, **When** the TTL time has elapsed, **Then** the post is not returned in post query requests.

---

### User Story 6 — Entra ID Login (Priority: P1)

As a user, I want to easily log in with Entra ID and use LinkUp immediately without separate registration.

**Why this priority**: Without authentication, no write functionality works,
so it is a prerequisite for all features.

**Independent Test**: Access the app → Entra ID login page → successful login → enter the map screen.
Display an appropriate error message on login failure.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user accesses the app, **When** they complete Entra ID login, **Then** they enter the map main screen and user identification information is maintained in the session.
2. **Given** an unauthenticated user accesses the app, **When** they do not log in, **Then** they can view the map in read-only mode (map browsing + marker display is allowed). When attempting to view post detail popups, create posts, or engage (Interested/Join), they are directed to the login screen.

---

### Edge Cases

- **3-sentence boundary**: When counting sentences based on periods/question marks/exclamation marks, line breaks alone or dots (.) within URLs must not be treated as sentence delimiters.
- **TTL concurrency**: If the TTL expires while a post popup is open, the popup should close or display a "This post has expired" message.
- **MCP timeout**: When the MCP/AI Foundry server response is slow (e.g., over 5 seconds), show a loading indicator in the recommendation section, and display "No suggestions available" on timeout.
- **MCP partial failure**: When some sources succeed but others fail (e.g., OneDrive succeeds but SharePoint/Email fail), display only the results from the successful sources and show "unavailable" for the failed sources. M365 sources and web sources are processed independently.
- **Action Hint generation failure**: If AI Foundry fails to generate an Action Hint, hide the hint area and display only the result list.
- **Semantic search results and map area mismatch**: Results from AI Foundry outside the current map view should not be displayed as markers, but should be shown as a "N results outside map" label at the bottom of the combined UI, and clicking it should pan the map to that area.
- **Semantic search 0 results within viewport**: If search results have 0 matches within the current map viewport, display a "No search results in this area" notice, and if there are results outside the viewport, provide a "N results outside map" indicator.
- **Duplicate engagement**: When the same user transitions from Interested → Join, the existing Interested should be upgraded to Join, and the count must not increase duplicately.
- **Post without coordinates**: When attempting to create a post without clicking the map, automatically assign default coordinates (map center) or require coordinate selection.
- **Empty map area**: When there are no posts in the current map view, display an empty state notice (e.g., "There are no posts in this area yet").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system must support user authentication via Entra ID.
- **FR-002**: Write functionality (post creation, engagement) must be blocked for unauthenticated users. The MVP authentication scope is limited to write-path gating, and the read path (map browsing) is allowed without authentication.
- **FR-003**: The main screen must be based on an interactive map, and posts must be represented as markers.
- **FR-004**: Users must be able to open the post creation modal via the "+" button.
- **FR-005**: Post body must be limited to 3 sentences or fewer, and this limit must be enforced on both the UI and server side.
- **FR-006**: Posts must have a mandatory TTL (expiration time), which users can select or a default value is applied.
- **FR-007**: Posts must have mandatory latitude/longitude coordinates. In the MVP, the map click point or map center is used as coordinates.
- **FR-008**: When a marker is clicked, the popup (or side panel) must display the post summary, remaining time, engagement buttons, and MCP recommendation section.
- **FR-009**: Users must be able to mark "Interested" or "Join" on a post.
- **FR-010**: Duplicate engagement by the same user must be handled idempotently (counted only once).
- **FR-011**: The participant count (Interested/Join) must be displayed in the post popup.
- **FR-012**: Posts with expired TTLs must be excluded from the map and query results. In the MVP, TTL enforcement is sufficient via query-time filtering (`expiresAt > now`); expired posts are excluded from query results but are not physically deleted from the DB (see Non-Goals for physical deletion).
- **FR-013** (FR7.1): MCP must integrate **M365 internal resource sources (OneDrive, SharePoint, Email) as the primary source**, and combine external data sources (Docs + Issues) as supplementary sources to provide search results. At least one M365 source must return results.
- **FR-014** (FR7.2): When creating/viewing posts, AI Foundry + MCP must be used to return "highly relevant posts/documents/issues." The app sends the user query and available MCP tool definitions to the LLM, and **the LLM decides which MCP tools to call and with what arguments** (LLM-driven tool orchestration). The app does not hardcode tool selection.
- **FR-015** (FR7.3): In map search, AI Foundry semantic search results must be re-filtered to the current map view area and displayed as markers. When search is active, markers matching search results should be highlighted, and markers not matching the results should be dimmed (reduced opacity) for visual distinction. Search result markers must be clearly distinguishable from regular markers through color or size changes.
- **FR-016** (FR7.4): Based on MCP results, a 1-line "Action Hint (next action suggestion)" must be generated and provided to the user. The Action Hint is placed at the top of the "Suggested via MCP" section in the post popup with an emphasized style (background color or bold), and must suggest a specific next action rather than a general summary (e.g., "Check Step 2 first," "Refer to related issue #42"). The Action Hint must be clickable and navigate to the corresponding resource when clicked.
- **FR-017** (FR7.5): Multiple results must be displayed in a single combined UI grouped by category ("Suggested via MCP" label included). Results must be displayed as sections separated by source category rather than a flat list, making multi-source integration visually clear. **Display order: M365 internal resources (📁 OneDrive → 📋 SharePoint → 📧 Email) → Web resources (📄 Docs → 🐛 Issues) → 📌 Related Posts.** M365 sources are placed at the top as primary, web sources are placed at the bottom as supplementary.
- **FR-018**: On MCP call failure, it must gracefully degrade with a "No suggestions available" message. On partial failure, only the results from successful sources should be displayed by category, and the failed source category must indicate an "unavailable" status in its section (e.g., OneDrive success + SharePoint failure → OneDrive results displayed normally + "SharePoint unavailable" shown in the SharePoint section). Even when all M365 sources fail, web source (Docs/Issues) results are still displayed.
- **FR-019**: Post body, PII, and sensitive data must not be logged in plain text.
- **FR-020**: Server-side validation must be performed on input values (body length, sentence count, coordinate range).
- **FR-021**: The post popup must display at least 2 distinct MCP UI elements: ① a categorized result list labeled "Suggested via MCP" (FR-017), ② an emphasized 1-line Action Hint at the top of the results (FR-016). These two elements must be visually clearly distinguished.
- **FR-022**: When performing a semantic search on the map and there are 0 results within the current viewport, a "No search results in this area" notice must be provided along with an "N results outside map" indicator. Users must be able to recognize that results exist outside the viewport through this indicator, and clicking it must pan the map to that area.
- **FR-023** (FR7.6): MCP tool invocation must follow an LLM-driven orchestration pattern:
  1. The app creates an in-process MCP server and connects via `InMemoryTransport` (same process, no HTTP).
  2. The app discovers available tools via `listTools()` and converts MCP tool schemas to OpenAI function-calling format.
  3. The app sends the user query and tool definitions to GPT-4o-mini.
  4. The LLM decides which tools to call (may call multiple tools, or choose not to call certain tools based on relevance).
  5. The app executes the LLM's chosen tool calls via MCP `callTool()` and returns the results.
  6. The LLM produces a final structured response (categorized results + Action Hint) based on tool outputs.
  7. This is the standard MCP integration pattern (LLM ↔ tool-use loop), not a hardcoded tool call sequence.
  8. The MCP server runs in-process (no sidecar) — tools can directly access the app's PostEmbedding cache, AI Foundry client, and DB.

### Key Entities

- **Post**: A short question/request/link of up to 3 sentences posted on the map. Includes author ID, body, tags (optional), coordinates (latitude/longitude), mode (online/offline/both, optional), creation timestamp, and expiration timestamp.
- **Engagement**: A participation signal sent by a user to a specific post. Includes post ID, user ID, engagement intent (interested/join), and creation timestamp. Only one exists per user-post combination.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can complete the process from login to post creation within 30 seconds.
- **SC-002**: A user can complete the process from marker click to viewing MCP combined search results (Docs+Posts+Issues) and Action Hint within 5 seconds.
- **SC-003**: The entire demo flow (login → post creation → MCP recommendations + Action Hint verification → Join → TTL expiration verification → marker filtering via search) can be demonstrated within 2 minutes (see Demo Script 6 steps).
- **SC-004**: When more than 3 sentences are entered, it is rejected on both the UI and server side in 100% of cases.
- **SC-005**: After TTL expiration, the post is excluded from the map and query results in 100% of cases.
- **SC-006**: Even during MCP/AI Foundry server failures, the remaining app features (post creation/viewing/engagement) function normally.
- **SC-008**: MCP combined search results include at least 2 source categories, with **at least 1 M365 source (OneDrive/SharePoint/Email)** included (e.g., OneDrive+Posts or OneDrive+Docs+Posts).
- **SC-009**: During map search, AI Foundry semantic search results are displayed as markers within the current map view area; search result markers are visually distinguished from regular markers with highlight (color/size changes), and non-result markers are dimmed.
- **SC-007**: Duplicate engagement by the same user is handled idempotently in 100% of cases, ensuring accurate counts.

## Assumptions

- The MVP target users are internal employees (CSA/SE/SA, etc.) who already have Entra ID accounts.
- Real-time GPS location of users is not used; coordinates are determined by map click/center point.
- TTL options are selected from 24 hours / 72 hours / 7 days, and short TTLs (1–5 minutes) are also supported for demo purposes.
- The TTL demo step (short TTL expiration verification) can be achieved with query-time filtering (`expiresAt > now`) alone; real-time push/WebSocket is unnecessary. When users refresh the map, expired posts disappear from the markers.
- The MCP server integrates **M365 internal resource sources (OneDrive, SharePoint, Email) as primary**, combines external data sources (Docs + Issues) as supplementary, and performs semantic search and Action Hint generation through AI Foundry.
- AI Foundry integration is done via the Azure AI Foundry SDK or REST API; model selection is determined in the plan phase.
- Popup engagement buttons are limited to 2 (Interested/Join); additional actions (chat/meeting) will be addressed in subsequent specs.
- The scope of read-only mode (unauthenticated users) allows map browsing + marker display, and accessing post detail popups requires authentication by default.
- MVP authentication acceptance criteria: ① Entra ID login success, ② session persistence — session is maintained even after refreshing post-login, ③ write guard — post creation/engagement is blocked for unauthenticated users. If these 3 work, the MVP authentication passes.

## UX Guidelines (Zenly-light)

- The main screen maintains the "single-screen map + floating + button" pattern.
- Popups provide only 1–2 action buttons at most (maintaining lightness).
- Colors/icons are composed in light tones (pastel/minimal).
- Navigation is simplified so the 2-minute demo script flows naturally.

## Safety & Reliability (MVP Baseline)

- Input validation: body length/sentence count/coordinate range/URL format validation is performed.
- Rate limiting (simple) or minimal abuse prevention is applied.
- Log masking: user input text is not logged verbatim.
- External calls such as MCP include timeout/failure handling.

## Demo Script (2 minutes)

> **Happy path scenario**: Login → Map → Post creation → MCP recommendations/Action Hint in popup → Join → Filtering via search
> **Fallback**: On MCP/AI Foundry failure → display "No suggestions available" in popup and proceed to Step 4 (Join). Each step can proceed independently, and failure at a previous step does not block the next step.

1. **Entra ID Login** — Login success → enter map main screen (handoff: verify session creation)
2. **Post Creation** — "+" button at map center → write 3-sentence post + select TTL → save (handoff: verify new marker on map)
3. **MCP Recommendations + Action Hint Verification** — Click new marker → in popup: ① verify 1-line Action Hint (emphasized style), ② verify "Suggested via MCP" categorized results — **M365 internal resources (OneDrive/SharePoint/Email) displayed first**, supplemented by web resources (Docs/Issues) and related Posts (handoff: on MCP failure, display "No suggestions available" and proceed to Step 4)
4. **Join** — Click "Join" → verify participant count increase (handoff: engagement recorded)
5. **TTL Expiration** — (demo short TTL) After post expiration, refresh map → verify marker disappears. Operates via query-time filtering only; real-time push/WebSocket is unnecessary (handoff: verify marker removal)
6. **Marker Filtering via Search** — Enter search query → AI Foundry semantic search → verify search result markers are highlighted + remaining markers are dimmed (handoff: verify visual distinction)
