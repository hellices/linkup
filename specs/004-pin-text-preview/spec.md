# Feature Specification: Pin Text Preview

**Feature Branch**: `004-pin-text-preview`  
**Created**: 2026-02-13  
**Status**: Draft  
**Input**: User description: "Show a text snippet on map speech-bubble pins that don't overlap with other pins, so users can get a sense of what the post is about without tapping it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Glanceable Post Preview on Solo Pins (Priority: P1)

A user opens the map and sees several speech-bubble pins scattered around their area. For pins that are standing alone (not clustered with other nearby pins), a short text snippet from the post appears next to or below the speech bubble. The user can immediately tell what the post is about — e.g., "Anyone want to grab lunch…" — without having to tap the pin first. This dramatically reduces the effort required to browse posts on the map.

**Why this priority**: This is the core value of the feature. Without it, users must tap every pin one-by-one to discover what's happening nearby, which is tedious and discourages exploration.

**Independent Test**: Can be fully tested by seeding the map with several non-overlapping posts and confirming that each solo pin displays a truncated text snippet beside or below the speech bubble.

**Acceptance Scenarios**:

1. **Given** a post exists at a location that is not clustered with any other post, **When** the map renders that pin, **Then** a truncated text snippet (first ~40 characters or first sentence, whichever is shorter) appears alongside or below the speech bubble.
2. **Given** a solo pin is visible on the map, **When** the user reads the snippet, **Then** it clearly belongs to the adjacent speech bubble and does not overlap unrelated UI elements.
3. **Given** the post text is very short (e.g., fewer than 10 characters), **When** the map renders, **Then** the full text is displayed without ellipsis.

---

### User Story 2 — Cluster Snippet Preview (Priority: P2)

When multiple posts cluster together (same or nearby location), the cluster marker shows a preview snippet from the most recent post alongside the count badge — giving users a glanceable hint of what's happening at that location without requiring a tap. The cluster badge displays the snippet of the newest post plus a "+N more" indicator for the remaining posts.

**Why this priority**: Clusters are the most common state on a busy map. Showing only a count ("3") tells users nothing about the content. The newest-post snippet answers "what's happening here?" at a glance and helps users decide whether to tap the cluster.

**Independent Test**: Can be tested by creating 3+ posts at the same location and verifying the cluster marker shows the newest post's snippet plus a "+2 more" label.

**Acceptance Scenarios**:

1. **Given** 3 posts cluster together and the newest was created 5 minutes ago, **When** the map renders the cluster, **Then** the cluster marker shows the newest post's truncated snippet text and a "+2 more" label below it.
2. **Given** a cluster of 2 posts, **When** the map renders, **Then** the cluster shows the newest post's snippet and "+1 more".
3. **Given** a cluster grows from 2 to 5 posts (new post added), **When** the map re-renders, **Then** the displayed snippet updates to the newest post's text and the count updates to "+4 more".
4. **Given** a cluster, **When** the user zooms in until posts separate into solo pins, **Then** the cluster preview disappears and each solo pin shows its own individual snippet.

---

### User Story 3 — Snippet Occlusion Avoidance (Priority: P3)

When two or more solo pins are near each other but NOT within the clustering radius, their text snippets could overlap or cover neighboring pins. The system detects when a snippet would occlude a nearby pin or another snippet, and hides the lower-priority snippet to keep the map readable.

**Why this priority**: Without occlusion handling, snippets on nearby-but-not-clustered pins create an unreadable mess. This ensures the map stays clean even in moderately dense areas.

**Independent Test**: Can be tested by creating two posts ~80px apart on screen (outside the 50px cluster radius) and verifying that only one snippet is shown, or both are shortened, to avoid overlap.

**Acceptance Scenarios**:

1. **Given** two solo pins are close enough that their snippets would overlap, **When** the map renders, **Then** only the more recent post's snippet is displayed; the older post's snippet is hidden.
2. **Given** a solo pin's snippet would visually cover a neighboring pin's bubble icon, **When** the map renders, **Then** the occluding snippet is hidden.
3. **Given** two solo pins whose snippets do NOT overlap, **When** the map renders, **Then** both snippets are displayed normally.
4. **Given** the user zooms in so that previously overlapping snippets now have enough room, **When** the map re-renders, **Then** both snippets become visible.

---

### User Story 4 — Snippet Respects Search Dimming (Priority: P4)

When the user performs a search and some pins are dimmed (because they don't match the query), the text snippets on dimmed pins should also be dimmed or hidden entirely so they don't distract from highlighted results.

**Why this priority**: Consistency with the existing search-highlight behavior. If dimmed pins still show prominent text, it undermines the visual hierarchy the search feature creates.

**Independent Test**: Can be tested by performing a search that matches some posts but not others, and verifying dimmed pins hide or dim their snippets.

**Acceptance Scenarios**:

1. **Given** a search is active and a solo pin does NOT match the query, **When** the map renders, **Then** that pin's text snippet is hidden or visually faded to match the pin's dimmed state.
2. **Given** a search is active and a solo pin DOES match the query, **When** the map renders, **Then** that pin's text snippet is fully visible and legible.
3. **Given** a search is cleared, **When** the map re-renders, **Then** all solo pins display their text snippets at normal opacity.

---

### Edge Cases

- What happens when two solo pins are near each other but not within the clustering radius — and their text snippets overlap? **→ Occlusion avoidance (US-3)**: the system hides the snippet of the older post; ties broken by post ID.
- What happens when a cluster snippet text would overlap an adjacent solo pin? **→ Cluster snippet is also subject to occlusion avoidance** — its bounding box is checked against nearby solo pin positions.
- What happens when a post's text contains only emojis or special characters? The snippet should display them faithfully.
- What happens when the map is at a very high zoom level and many solo pins are visible? Performance should not degrade noticeably; the occlusion check is O(n·k) where k is the average number of nearby markers (bounded by grid cell neighbors), not O(n²).
- What happens with right-to-left (RTL) text? Snippets should render correctly for the text direction of the content.
- What happens when a cluster has only 1 remaining non-expired post? It becomes a solo pin and shows individual snippet behavior (not "+0 more").
- What happens when a cluster's newest post has very short text (e.g., 3 characters)? The snippet is shown in full; the "+N more" label still appears on the next line.
- What happens when all posts in a cluster are search-dimmed? The cluster snippet is also dimmed/hidden, consistent with existing cluster dimming behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a truncated text snippet for every solo (non-clustered) post pin on the map.
- **FR-002**: Snippets MUST be truncated to a maximum of approximately 40 characters, ending with an ellipsis ("…") if the original text is longer.
- **FR-003**: Snippets MUST be visually attached to or positioned directly below the speech-bubble pin so the association between pin and text is unambiguous.
- **FR-004**: Cluster markers MUST display the newest post's truncated snippet text and a "+N more" count label (where N is the remaining number of posts in the cluster).
- **FR-005**: The cluster snippet MUST always show the most recent post (by `createdAt`), sorted newest-first.
- **FR-006**: When search results are active, snippets on dimmed (non-matching) solo pins MUST be hidden or reduced to the same dimmed opacity as the pin itself.
- **FR-007**: Cluster snippets on fully-dimmed clusters (no post matches search) MUST also be dimmed/hidden.
- **FR-008**: Snippets MUST re-render correctly when the map zoom level changes and pins transition between solo and clustered states.
- **FR-009**: Snippet text MUST be read-only and not interactive — tapping/clicking the snippet should behave the same as tapping the speech-bubble pin (open the post detail panel). For cluster snippets, tapping opens the ClusterListPanel.
- **FR-010**: The snippet font size and styling MUST be legible on both standard and high-DPI displays.
- **FR-011**: When a solo pin's snippet would overlap a nearby pin or another snippet (pixel-distance check), the system MUST hide the lower-priority snippet (older post). The check uses the same grid-based spatial index as clustering for O(n·k) efficiency.
- **FR-012**: Occlusion avoidance MUST be recalculated on every `renderMarkers()` call (zoom/pan/data change) to stay current with the viewport.

### Key Entities

- **PostSummary**: The existing entity that contains the `text` field from which snippets are derived. No new entities are required; the feature reads existing post data.
- **Snippet**: A derived, display-only truncation of `PostSummary.text`, rendered as part of the map pin's HTML marker. Not persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the topic of at least 80% of visible solo posts without tapping any pin, reducing average taps-to-discover by 50% compared to today's behavior.
- **SC-002**: No text snippet overlaps another pin, snippet, or key UI element (search bar, panels) on any standard viewport size. Verified via occlusion avoidance (FR-011).
- **SC-003**: Map rendering time with 50 visible solo pins (each showing a snippet) remains under 500 ms, with no perceptible jank during zoom transitions.
- **SC-004**: 90% of users surveyed find the snippet text helpful for deciding which post to open.

## Assumptions

- A snippet length of ~40 characters provides enough context for a glanceable preview without over-cluttering the map. This can be tuned during implementation.
- The existing `PostSummary.text` field always contains at least some meaningful text (the post creation form already validates non-empty text).
- Snippets are rendered as part of the existing `HtmlMarker` approach (same rendering pipeline), so no new map layer or popup mechanism is needed.
- Performance impact of adding a small text element to each solo pin is negligible for typical post densities (≤100 visible markers).
- RTL text rendering is handled by the browser's native text direction support and does not require special logic in the snippet template.
