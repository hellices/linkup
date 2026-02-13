# Feature Specification: Pin Category Icons & Clustering

**Feature Branch**: `003-pin-category-icons`  
**Created**: 2026-02-13  
**Status**: Draft  
**Input**: User description: "Add category icons/emoji per collaboration type to pins for visual distinction (share, discussion, question, etc.) + cluster overlapping pins"

## Summary

Currently all LinkUp pins (markers) are rendered with the same 💬 emoji inside an identical blue circle, making it difficult to determine at a glance whether a post is a question, a knowledge-share, or a meetup request. Additionally, **when multiple pins overlap at the same location, the pins behind the front one are impossible to select**.

This feature addresses both problems together:
1. **Category-based pin classification**: Users select a collaboration type (category) when creating a post, and the map pin is rendered as a speech-bubble marker with a distinct emoji and color per category.
2. **Overlapping pin clustering**: When pins overlap on screen, they are merged into a single cluster marker showing a numeric badge. Clicking the cluster opens a chronological list panel from which any individual post can be selected.

## Non-Goals (Excluded from this feature)

- User-defined categories (custom category creation/deletion/renaming)
- Category-based filtering or search (to be addressed as a separate feature)
- Advanced pin animations (3D effects, particle effects on click, etc.)
- Category statistics or analytics dashboard
- Changing a post's category after creation
- Advanced clustering algorithms (density-based, heatmaps, etc.) — simple proximity-based grouping is sufficient
- In-cluster post preview cards — selecting from the list transitions to the existing popup

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Post Creation with Category Selection (Priority: P1)

When a user opens the post creation modal via the "+" button, they can select a **post type (category)** in addition to entering text. Each category is shown with a visually distinct emoji/icon and a short label, and the map marker shape changes based on the selected category.

**Why this priority**: Without category selection, pin classification is impossible — this is the core foundation. Adding category selection to the post creation flow is a prerequisite for all other parts of this feature.

**Independent Test**: Sign in → "+" button → select one of 5 categories → enter text + select TTL → save → verify the new marker on the map shows the selected category's emoji.

**Acceptance Scenarios**:

1. **Given** an authenticated user has opened the post creation modal, **When** they view the category selection area, **Then** 5 category options (❓ Question, 💬 Discussion, 💡 Share, 🆘 Help, ☕ Meetup) are displayed with emoji + label.
2. **Given** a user has not explicitly selected a category, **When** they save the post, **Then** the default category (💬 Discussion) is automatically applied.
3. **Given** a user selects the "💡 Share" category and saves the post, **When** they check the marker on the map, **Then** the pin is rendered as a speech-bubble with the 💡 emoji and the Share category color.
4. **Given** a user has already selected a category, **When** they tap a different category, **Then** the previous selection is deselected and the new category is selected (single-select).

---

### User Story 2 — Differentiated Pin Display by Category (Priority: P1)

Users can distinguish posts of different categories at a glance on the map. Each category has a unique emoji and color combination, and pins are rendered as speech-bubble markers to convey intent more clearly than the current uniform circles.

**Why this priority**: Even with category selection, if there is no visual difference on the map, the feature delivers no value. Pin rendering is P1 alongside category setup.

**Independent Test**: Create 3+ posts with different categories → verify each appears on the map as a speech-bubble pin with a distinct emoji/color.

**Acceptance Scenarios**:

1. **Given** posts of multiple categories are displayed on the map, **When** the user scans the map, **Then** each post's pin is rendered as a speech-bubble with a category-specific emoji and color.
2. **Given** a "❓ Question" category post exists, **When** its marker is viewed, **Then** the pin is rendered as a speech-bubble with the Question category's unique color (blue palette) and the ❓ emoji.
3. **Given** search is active, **When** a marker matching the search results is highlighted, **Then** the category emoji is preserved while the highlight color/size treatment is applied (coexists with existing search highlight behavior).

---

### User Story 3 — Category Display in Post Popup (Priority: P2)

When a user clicks a marker to open the post popup, they can visually confirm the post's category. The category emoji + label is shown within the post detail view.

**Why this priority**: Showing the category in the popup is a supplementary confirmation; the pin differentiation on the map alone delivers core value. However, displaying the category in the popup provides a consistent UX.

**Independent Test**: Click a post marker of a specific category → verify the popup shows the category emoji + label.

**Acceptance Scenarios**:

1. **Given** a user clicks a "💡 Share" category post marker, **When** the popup opens, **Then** a "💡 Share" label is displayed near the author info or at the top of the popup.
2. **Given** a post created with the default category (💬 Discussion) is opened, **When** viewing the popup, **Then** the "💬 Discussion" category is displayed.

---

### User Story 4 — Overlapping Pin Clustering & List Selection (Priority: P1)

When multiple posts are at the same or nearby locations, the pins currently overlap and the back pins become unselectable. This story merges overlapping pins into a **cluster marker with a numeric badge**, and clicking it opens a **chronological post list panel** from which the user can select any individual post.

**Why this priority**: Being completely unable to access back-positioned posts when pins overlap is effectively a functional defect. This must be resolved alongside category-based pin classification for map-based discovery to work practically.

**Independent Test**: Create 3 posts at the same coordinates (or very close) → verify the map shows a cluster marker with "3" → click → chronological post list is displayed → select one → the post's detail popup opens.

**Acceptance Scenarios**:

1. **Given** 2 or more posts exist at nearby positions on screen, **When** the map is viewed at the current zoom level, **Then** overlapping pins are merged into a single cluster marker with a numeric badge showing the post count.
2. **Given** a cluster marker is displayed, **When** the user clicks the cluster marker, **Then** a list panel is displayed showing the cluster's posts sorted chronologically (newest first).
3. **Given** the cluster list panel is open, **When** the user selects a specific post from the list, **Then** the existing post detail popup opens for that post.
4. **Given** posts in a cluster have different categories, **When** the list panel is viewed, **Then** each post's category emoji + label is shown alongside its list entry.
5. **Given** the user zooms in enough that pins no longer overlap, **When** the map is viewed, **Then** the cluster dissolves and individual pins are displayed separately.

---

### Edge Cases

- **Legacy post compatibility**: Existing posts without a category field are displayed with the default category (💬 Discussion).
- **No category selected**: If the user does not explicitly select a category, the default category (💬 Discussion) is automatically applied.
- **Search highlight and category coexistence**: When search is active, marker highlight/dimming is applied as before, but the category emoji is always preserved. The post type must remain identifiable even in the highlighted state.
- **Speech-bubble pin legibility on small screens**: The emoji must remain identifiable at a minimum size even on mobile or when zoomed out.
- **Cluster reduced to 1 post**: If a cluster's post count drops to 1 (e.g., due to TTL expiration), the cluster dissolves and the remaining post is shown as an individual pin.
- **Cluster marker and search highlight**: When search is active, if at least one post in a cluster matches the search results, the cluster marker receives the highlight treatment. If none match, the cluster is dimmed.
- **Cluster behavior by zoom level**: Zooming out merges more pins into clusters; zooming in dissolves clusters into individual pins.
- **Map interaction while cluster list is open**: If the user pans or zooms the map while the cluster list panel is open, the panel automatically closes.
- **Posts at exactly the same coordinates**: When multiple posts share identical coordinates, the cluster persists even at maximum zoom, and individual posts can only be accessed through the list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system must support a category (type) field on posts. Categories are selected from a predefined list; allowed values are `question`, `discussion`, `share`, `help`, and `meetup`.
- **FR-002**: Each category must have a unique emoji, display label, and color combination:
  - `question` — ❓ Question — blue palette
  - `discussion` — 💬 Discussion — purple palette
  - `share` — 💡 Share — yellow/orange palette
  - `help` — 🆘 Help — pink/red palette
  - `meetup` — ☕ Meetup — green palette
- **FR-003**: The post creation modal must include a category selection UI. Each category is displayed as emoji + label, and only one can be selected at a time via tap/click.
- **FR-004**: If no category is explicitly selected, the default value `discussion` (💬 Discussion) must be applied.
- **FR-005**: Map pins must be rendered as **speech-bubble shaped** markers containing the category's emoji. These replace the existing circular markers.
- **FR-006**: Each category's pin must apply the category's unique color as the speech-bubble background or border.
- **FR-007**: During search highlight/dim treatment, category emojis must be preserved. Highlighted markers show the category emoji alongside the existing treatment (size increase + orange color), and dimmed markers retain the category emoji at reduced opacity.
- **FR-008**: The post popup (detail view) must display the category emoji + label.
- **FR-009**: Existing posts without a category field must default to `discussion` (💬 Discussion) for display.
- **FR-010**: The post creation request must include a `category` field, and the server must validate that it contains an allowed category value.
- **FR-011**: Speech-bubble pins must maintain a minimum size (at least 32px) at which the emoji remains identifiable.
- **FR-012**: When 2 or more posts are at nearby positions on screen (overlapping area), they must be displayed as a **cluster marker** instead of individual pins. The cluster marker must show the contained post count as a numeric badge.
- **FR-013**: Clicking a cluster marker must display a list panel showing the cluster's posts sorted **chronologically (newest first)**.
- **FR-014**: Each item in the cluster list panel must show the category emoji, a post text summary (first line or truncated), author name, and time remaining.
- **FR-015**: Selecting a post from the cluster list must open the existing post detail popup.
- **FR-016**: When the user zooms in enough that pins no longer overlap, clusters must dissolve and individual pins must be displayed.
- **FR-017**: If a cluster's post count drops to 1 (e.g., due to TTL expiration), the cluster must automatically dissolve into an individual pin.
- **FR-018**: When search is active, cluster markers containing at least one search-result post must receive the highlight treatment; clusters containing no search-result posts must be dimmed.

### Key Entities

- **Post** (extended): A `category` field is added to the existing Post entity. It represents the collaboration type and holds one of `question | discussion | share | help | meetup`. Defaults to `discussion`.
- **PostCategory** (category definition): A mapping that defines each category's ID, emoji, display label, and color combination. Composed of 5 predefined categories.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can select a category in the post creation modal within 3 seconds.
- **SC-002**: Looking at 3 posts of different categories on the map, a user can distinguish each type by emoji/color alone within 5 seconds.
- **SC-003**: Existing posts (without a category) are displayed correctly with the default category (💬 Discussion) in 100% of cases.
- **SC-004**: The end-to-end flow from category selection → post save → category pin displayed on map adds no more than 5 seconds to existing post creation time.
- **SC-005**: When search highlight is active, all pins retain their category emoji in 100% of cases.
- **SC-006**: All 5 categories are visually distinguishable on the map (distinct emoji + distinct color for each).
- **SC-007**: When 3 posts are at the same location, the cluster marker displays the number "3", and clicking it shows all 3 posts in a chronological list.
- **SC-008**: Selecting a post from the cluster list opens the post's detail popup within 2 seconds.
- **SC-009**: All posts at overlapping positions are 100% accessible via the cluster list (resolving the "back pins unselectable" problem).

## Assumptions

- Categories are fixed at 5 (`question`, `discussion`, `share`, `help`, `meetup`). Custom category creation is deferred to a future feature.
- For backward compatibility with existing posts, the `category` field defaults to `discussion`.
- Speech-bubble pin styling is assumed to be achievable with map HTML markers.
- Category colors follow the existing Zenly-light design guidelines (pastel/light tones).
- Category selection is only available during post creation; changing the category after creation is not supported.
- The category selection UI in the post creation modal uses a button-group layout similar to the TTL selector.
- Cluster proximity threshold is based on whether pins overlap on screen at the current zoom level; the exact pixel threshold is determined during implementation.
- The cluster list panel is displayed as an overlay (floating panel or side panel) on the map.
- The cluster marker's visual style is consistent with the existing Zenly-light design, with the numeric badge clearly visible.
