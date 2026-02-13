# Feature Specification: Post Replies & Document Sharing

**Feature Branch**: `005-post-replies-docs`  
**Created**: 2025-02-13  
**Status**: Draft  
**Input**: User description: "Currently the only way to respond to a post is via two buttons (Interested / Join). Users should be able to leave text replies. Additionally, users should be able to share M365 documents found via MCP Suggestions as links on the post. Replies and shared documents should be displayed in separate sections for efficient browsing, with pagination or scrolling when the list grows long."

## Assumptions

- Only authenticated (signed-in) users can write replies.
- Document link sharing is based on M365 documents returned by existing MCP Suggestions — users select a document from that list to share it publicly on the post.
- Replies contain text only — no image or file attachments.
- Replies cannot be created on expired posts, but existing replies remain visible.
- Nested replies (threads) are out of scope — only single-level replies are supported.
- A user may post multiple replies on the same post.
- The shared documents section displays M365 document links in chronological order.
- Pagination baseline: each section initially loads 5 items; additional items are fetched via a "Load more" button or scrolling.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write a Text Reply on a Post (Priority: P1)

A signed-in user writes a text reply on the post detail view (PostPopup) to communicate with other users. Replies appear in a dedicated "Replies" section below the Interested / Join buttons, showing the author name, timestamp, and reply text.

**Why this priority**: This directly addresses the limitation of having only two reaction buttons. It is the core feature that enables meaningful conversation on posts.

**Independent Test**: Sign in, open any post, write a reply, and verify it appears at the top of the replies list immediately.

**Acceptance Scenarios**:

1. **Given** a signed-in user is viewing a post popup, **When** they type text in the reply input and press the send button, **Then** the reply appears at the top of the "Replies" section immediately, showing the author name and timestamp.
2. **Given** an unauthenticated user is viewing a post popup, **When** they look at the reply input area, **Then** a "Sign in to reply" message is displayed and the input is disabled.
3. **Given** a user is viewing the popup of an expired post, **When** they check the replies section, **Then** existing replies are visible but new reply creation is disabled.
4. **Given** the reply input is empty, **When** the user presses the send button, **Then** the reply is not submitted and the input field receives focus.

---

### User Story 2 - Share an M365 Document Link (Priority: P2)

A signed-in user shares one of their M365 documents (OneDrive, SharePoint, or Email) as a link on a post. From the MCP Suggestions list, the user selects a document to share, and it is added to the post's "Shared Documents" section visible to all viewers.

**Why this priority**: MCP Suggestions are currently only visible to the viewing user. Enabling document sharing turns personal recommendations into collaborative resources, increasing the platform's value.

**Independent Test**: Click the "Share" button next to an M365 document in MCP Suggestions and verify it appears in the "Shared Documents" section.

**Acceptance Scenarios**:

1. **Given** a signed-in user sees M365 documents in MCP Suggestions on a post popup, **When** they click the "Share" button next to a document, **Then** the document link is added to the "Shared Documents" section with the sharer's name and timestamp.
2. **Given** a document with the same URL has already been shared on the post, **When** the user tries to share it again, **Then** the duplicate is prevented and a message indicates the document is already shared.
3. **Given** shared documents exist in the section, **When** the user clicks a document title, **Then** the M365 document opens in a new browser tab.

---

### User Story 3 - Section Separation & Pagination (Priority: P2)

Users browse replies and shared documents in the post popup as two visually distinct sections. Each section initially displays up to 5 items, with a "Load more" button to fetch additional items when more exist.

**Why this priority**: Mixing replies and documents in a single list would reduce readability. Clear section separation with pagination is essential for a good user experience.

**Independent Test**: Open a post with 6+ replies, confirm only the first 5 are shown, and press "Load more" to verify the rest loads.

**Acceptance Scenarios**:

1. **Given** a post has 7 replies, **When** the user opens the post popup, **Then** the "Replies" section shows the 5 most recent replies and a "Load more" button is visible.
2. **Given** the "Load more" button is visible, **When** the user clicks it, **Then** the remaining 2 replies are loaded and the "Load more" button disappears.
3. **Given** a user is viewing the post popup, **When** they look at the layout, **Then** the "Replies" section and "Shared Documents" section are visually separated by distinct headers or tabs.
4. **Given** a post has 3 shared documents and 10 replies, **When** the user opens the popup, **Then** all 3 documents are shown in the documents section while only 5 replies are shown initially.

---

### User Story 4 - Delete Own Reply (Priority: P3)

The author of a reply can delete their own reply.

**Why this priority**: Users need the ability to remove typos or incorrect content, but the core flow (create / read) takes precedence.

**Independent Test**: Verify a delete button appears on the user's own reply and that clicking it removes the reply from the list.

**Acceptance Scenarios**:

1. **Given** a signed-in user is viewing their own reply, **When** they click the delete button, **Then** a confirmation dialog appears, and upon confirmation the reply is immediately removed from the list.
2. **Given** a user is viewing a reply written by someone else, **When** they inspect the reply, **Then** no delete button is displayed.

---

### Edge Cases

- What happens if a reply is submitted right after the post expires? → The server re-validates expiry and returns a "Post has expired — replies are no longer accepted" error.
- What if the reply text is very long? → Reply length is capped at 500 characters; the input blocks further typing beyond the limit.
- What if an M365 document URL is no longer valid? → The link is preserved as-is; access errors are handled by M365, not by LinkUp.
- What if reply submission fails due to a network error? → An error message is shown to the user and the input content is preserved so they can retry.
- What if there are zero replies? → A prompt reading "No replies yet. Be the first to reply!" is displayed.
- What if there are zero shared documents? → A message reading "No shared documents" is displayed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authenticated users MUST be able to write text replies on non-expired posts.
- **FR-002**: Each reply MUST include the author name, creation timestamp, and text content.
- **FR-003**: Replies MUST be sorted in reverse-chronological order (newest first).
- **FR-004**: Reply length MUST be constrained to a minimum of 1 character and a maximum of 500 characters.
- **FR-005**: Unauthenticated users MUST see a sign-in prompt and a disabled reply input.
- **FR-006**: On expired posts, existing replies MUST remain visible but new reply creation MUST be disabled.
- **FR-007**: Reply authors MUST be able to delete their own replies.
- **FR-008**: Authenticated users MUST be able to share M365 documents from MCP Suggestions onto a post.
- **FR-009**: Each shared document MUST include the document title, original URL, sharer name, share timestamp, and source type (OneDrive / SharePoint / Email / Link).
- **FR-010**: Duplicate sharing of the same URL on the same post MUST be prevented.
- **FR-011**: The post popup MUST visually separate "Replies" and "Shared Documents" into distinct sections.
- **FR-012**: Each section MUST initially display up to 5 items, with a "Load more" button when additional items exist.
- **FR-013**: The "Load more" action MUST fetch the next batch of 5 items.
- **FR-014**: On reply submission failure, the system MUST display an error message and preserve the user's input.
- **FR-015**: Clicking a shared document link MUST open the document in a new browser tab.
- **FR-016**: Authenticated users MUST be able to manually share an arbitrary link (title + URL) on a non-expired post via a "Share a link" form, with sourceType set to "link".

### Key Entities

- **Reply**: A text response to a post. Contains post ID, author ID, author name, reply text, and creation timestamp. A post has many replies.
- **SharedDocument**: A document link shared by a user on a post. Contains post ID, sharer ID, sharer name, document title, document URL, source type (onedrive / sharepoint / email / link), and share timestamp. A post has many shared documents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly submitted reply is visible in the replies list within 3 seconds.
- **SC-002**: Average number of interactions per post increases compared to the button-only baseline.
- **SC-003**: Users can locate desired information (reply or document) within 10 seconds thanks to clear section separation.
- **SC-004**: Posts with 50+ replies load the popup within 2 seconds (initial batch of 5 items only).
- **SC-005**: At least 20% of posts have one or more shared documents after feature adoption.
- **SC-006**: Empty or over-500-character reply submissions are blocked 100% of the time.
