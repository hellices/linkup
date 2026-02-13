# Research: Pin Text Preview — HtmlMarker Text Rendering

**Feature**: 004-pin-text-preview  
**Date**: 2026-02-13  
**Scope**: Adding truncated text snippets to Azure Maps `atlas.HtmlMarker` speech-bubble pins — text rendering behavior, CSS truncation in inline styles, snippet positioning, JS truncation logic, performance implications, **cluster snippet preview design**, and **snippet occlusion avoidance**.

---

## Question 1: Azure Maps HtmlMarker Text Rendering

### Context

The existing `buildSpeechBubbleHtml()` in `MapView.tsx` builds a speech-bubble marker using inline HTML/CSS: a rounded `div` body (emoji + background), a CSS border-trick triangle tail, and an optional pulse-ring for highlights. The proposal adds a small `<div>` containing truncated post text below the tail. We need to understand how text content behaves inside `HtmlMarker` and whether there are gotchas at scale.

### Findings

**How `HtmlMarker` renders**: Azure Maps `HtmlMarker` injects the `htmlContent` string as a child of a positioned DOM element (`<div>`) managed by `HtmlMarkerManager`. The marker div is absolutely positioned on the map canvas overlay via CSS `transform: translate(...)`, updated on every pan/zoom. The content is standard DOM — any valid HTML/CSS works, including text nodes, custom fonts, and nested divs.

**Text rendering behavior**:
- Text in an HtmlMarker behaves identically to text in any DOM element. The browser's text rendering engine handles font rasterization, subpixel antialiasing, and line breaking.
- **Font rendering**: System fonts (`sans-serif`, `-apple-system`, `Segoe UI`) render crisply at all zoom levels because the DOM layer is independent of the WebGL map canvas. There is no rasterization/scaling issue like with `SymbolLayer` text (which renders into WebGL textures).
- **Text overflow**: Standard CSS `overflow: hidden` and `text-overflow: ellipsis` work correctly inside HtmlMarker content. These are pure CSS properties applied to the DOM — the HtmlMarker container does not interfere.
- **Z-index stacking**: HtmlMarkers are rendered in DOM order within the marker container. Later-added markers appear on top. Azure Maps does **not** automatically manage z-index collisions between HtmlMarkers — if two markers overlap, the later one covers the earlier one. The `z-index` CSS property on the marker's root element is respected but applies within the marker manager's container.

**Gotchas identified**:
1. **No automatic collision detection**: Unlike `SymbolLayer` (which has `allowOverlap: false` by default and hides overlapping labels), HtmlMarkers have no built-in label collision avoidance. Snippet text that extends beyond the bubble footprint can overlap adjacent markers. Mitigation: keep snippet width narrow (≤120px) and rely on the existing clustering to separate nearby pins.
2. **White-space and line breaks**: If post text contains newlines or very long words, the text div could expand unexpectedly. Mitigation: use `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis` in inline styles.
3. **High-DPI rendering**: DOM text on HtmlMarkers benefits from the browser's native high-DPI rendering — no special handling needed. Text will be sharp on Retina/4K displays.
4. **Pointer events**: The text div will be part of the marker's DOM subtree, so click events on the text will bubble up to the marker's click handler — no additional event wiring needed (FR-007 satisfied by default).

### Decision

**Adding a text `<div>` inside `HtmlMarker.htmlContent` is fully supported and straightforward.** No Azure Maps–specific workarounds are needed. The text div is just more DOM content inside the marker wrapper.

### Key Risk

The only risk is **visual overlap between snippet text of adjacent pins**. This is mitigated by:
- Constraining snippet width to ≤120px via `max-width` inline style.
- Hiding snippets on clustered pins (they only appear on solo pins).
- The existing 50px clustering radius already separates nearby solo pins spatially.

---

## Question 2: CSS Text Truncation in Inline Styles

### Context

The constraint is **no external CSS files** — all styling must be inline `style` attributes within the `htmlContent` string. We need single-line truncation with ellipsis, capped at ~120px width.

### Approaches Evaluated

| Approach | Works Inline? | Browser Support | Notes |
|----------|:---:|:---:|-------|
| `text-overflow: ellipsis` + `overflow: hidden` + `white-space: nowrap` + `max-width` | ✅ | All modern | Standard CSS truncation — requires the container to be a block-level element with a defined width constraint |
| `-webkit-line-clamp` (multi-line truncation) | ❌ | Requires `display: -webkit-box` | Overkill for single line; also needs `-webkit-box-orient: vertical` which is non-standard |
| JavaScript string truncation only (no CSS) | ✅ | N/A | Simpler but doesn't adapt to actual rendered width; may cut too aggressively or not enough |

### Decision: **CSS truncation + JS pre-truncation (belt and suspenders)**

Use **both** approaches together:
1. **JS pre-truncation** at ~40 characters (word-boundary aware) — ensures the string passed to the DOM is already short, preventing long DOM text nodes.
2. **CSS inline truncation** as a visual safety net — handles edge cases where 40 characters of wide characters (e.g., "WWWWWW...") exceed the 120px width.

### Exact Inline Style String

```
style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#374151;text-align:center;line-height:1.2;margin-top:2px;pointer-events:none"
```

**Property breakdown**:

| Property | Value | Purpose |
|----------|-------|---------|
| `max-width` | `120px` | Caps the text container width to prevent overlap with neighboring pins |
| `overflow` | `hidden` | Required for `text-overflow` to take effect |
| `text-overflow` | `ellipsis` | Adds "…" when text overflows the container |
| `white-space` | `nowrap` | Prevents line wrapping — keeps snippet to one line |
| `font-size` | `11px` | Small but legible; subordinate to the emoji bubble visually |
| `color` | `#374151` | Tailwind `gray-700` — readable on the map without being too bold |
| `text-align` | `center` | Centers text under the bubble tail for visual alignment |
| `line-height` | `1.2` | Tight line height to minimize vertical space |
| `margin-top` | `2px` | Small gap between the tail tip and the text |
| `pointer-events` | `none` | Ensures clicks pass through the text to the marker's click handler (avoids double-event issues); the marker's outer div already has `cursor: pointer` |

### Alternatives Rejected

- **`width: 120px` (fixed, not max)**: Would force all snippets to be exactly 120px wide even for short text like "Hi", creating unnecessary visual weight. `max-width` allows short text to shrink-wrap.
- **Multi-line with `-webkit-line-clamp`**: Adds visual complexity and vertical height. Single-line is cleaner for a map label.
- **No CSS truncation (JS only)**: Character count doesn't reliably predict pixel width. A 40-char string of "iii" is much narrower than 40 chars of "WWW". CSS truncation handles this gracefully.

---

## Question 3: Snippet Positioning

### Context

The current speech-bubble marker structure (top to bottom):
1. Pulse ring (`position: absolute`, behind the bubble)
2. Bubble body (rounded rect, ~40px tall, contains emoji)
3. Tail (CSS triangle, 8px tall, pointing down)
4. `pixelOffset: [0, -28]` shifts the entire marker up so the tail tip sits on the geographic coordinate

The question: should the text snippet go **BELOW the tail** or **to the RIGHT of the bubble**?

### Options Evaluated

| Position | Pros | Cons |
|----------|------|------|
| **Below tail** | Natural reading flow (top-down); text is clearly "attached" to the pin via the tail; centered under the pin so symmetrical; doesn't widen the marker's horizontal footprint | Increases vertical footprint; may occlude map content directly below the pin |
| **Right of bubble** | Doesn't increase vertical footprint; resembles a chat/tooltip label | Asymmetric — would require shifting `pixelOffset` to re-center; increases horizontal footprint more than vertical (120px to the right); harder to visually associate with the correct pin when pins are close; would break the existing centered alignment |
| **Above bubble** | Clear visibility | Fights with the pulse ring animation; unnatural (speech bubbles point down, text above looks disconnected) |
| **Left of bubble** | Same as right but opposite direction | Same issues as right; RTL confusion |

### Decision: **BELOW the tail (centered)**

### Rationale

1. **Visual hierarchy**: The speech bubble "speaks" downward via the tail — the text snippet continues that downward flow naturally. It reads like a caption or label beneath a pin.
2. **Centered alignment**: The existing `flex-direction: column` + `align-items: center` on the outer container means a new child div after the tail automatically centers below it. Zero layout changes needed.
3. **No `pixelOffset` change needed**: The offset `[0, -28]` already positions the tail tip at the geographic point. The text hangs below that point, which is acceptable because map labels commonly extend below their anchor. The text is small (11px font, ~15px total height) and does not significantly obscure the map.
4. **Minimal horizontal spread**: At `max-width: 120px` centered, the text extends ±60px from the pin center — roughly the same as the bubble body's visual width with the pulse ring. Pins to the right/left are not impacted.
5. **Simple implementation**: Just append one more `<div>` to the existing `flex-column` container. No restructuring of the HTML template.

### Positioning Detail

```
             ┌─────────┐
             │  😊     │  ← Bubble body (40×40px, centered)
             └────┬────┘
                  ▼       ← Tail (8px triangle)
          "Anyone want…"  ← Snippet text (max-width 120px, centered)
                  •       ← Geographic coordinate (tail tip)
```

The geographic coordinate is at the tail tip. The snippet text appears ~2px below the tail. Because it's centered and narrow (≤120px), it stays within the visual footprint of the pulse ring animation (which is 52px diameter = ±26px, while the text may extend ±60px — slightly wider but still compact).

### `pixelOffset` Consideration

The current `pixelOffset: [0, -28]` lifts the marker so the tail tip aligns with the geo-coordinate. Adding ~15px of text below the tail means the text sits 15px below the geographic point on screen. This is acceptable — the text is a label, not a position indicator. **No change to `pixelOffset` is recommended** to avoid shifting the pin away from its coordinate.

---

## Question 4: Text Truncation in JavaScript

### Context

Need to truncate `PostSummary.text` to ~40 characters at a word boundary, appending "…" if truncated.

### Approaches Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| Hard cut at 40 chars + "…" | Simplest | Cuts mid-word ("Anyone want to gra…") — ugly and harder to read |
| Word-boundary cut ≤40 chars + "…" | Clean word breaks; professional appearance | Slightly more logic; may produce very short output if a long word starts near the boundary |
| Sentence-aware (first sentence if short) | Most natural | Over-engineered for a map label; sentences can be long |

### Decision: **Word-boundary truncation at ~40 characters**

### Recommended TypeScript Function

```typescript
/** Truncate text to ~maxLen characters at a word boundary, appending "…" if needed. */
function truncateSnippet(text: string, maxLen = 40): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.lastIndexOf(" ", maxLen);
  // If no space found (single very long word), hard-cut at maxLen
  const end = cut > 0 ? cut : maxLen;
  return cleaned.slice(0, end) + "…";
}
```

**Behavior examples**:

| Input | Output |
|-------|--------|
| `"Anyone want to grab lunch near the office today?"` | `"Anyone want to grab lunch near the…"` |
| `"Hi"` | `"Hi"` (no truncation) |
| `"Superlongwordwithnospacesrepeatedmany"` | `"Superlongwordwithnospacesrepeatedmany"` (39 chars, under limit) |
| `"Superlongwordwithnospacesrepeatedmanytimes"` | `"Superlongwordwithnospacesrepeatedmanyt…"` (hard-cut fallback) |
| `"Looking\nfor\nsomeone to\nplay chess"` | `"Looking for someone to play chess"` (newlines normalized) |

**Design choices**:
- **Whitespace normalization**: `replace(/\s+/g, " ").trim()` collapses newlines, tabs, and multiple spaces into single spaces — important because map labels should be single-line.
- **Word-boundary search**: `lastIndexOf(" ", maxLen)` finds the last space at or before position 40. This ensures we never cut mid-word.
- **Hard-cut fallback**: If the text has no spaces within the first 40 characters (e.g., a URL or a very long word), we hard-cut at `maxLen` rather than showing nothing. This is rare and acceptable.
- **Ellipsis character**: The "…" (U+2026 HORIZONTAL ELLIPSIS) is a single character, not "..." (three dots). It renders more cleanly at small font sizes and is semantically correct.

---

## Question 5: Performance Considerations

### Context

The plan specifies "pin rendering at 60fps for up to 200 markers with snippets; no perceptible jank during zoom transitions." The current implementation creates/destroys HtmlMarkers on every `renderMarkers()` call (triggered by `moveend`, `zoomend`, and data changes). Adding a text div to each marker increases DOM complexity.

### Analysis

#### HtmlMarker DOM Cost

**Current per-marker DOM structure** (solo pin):
- 1 outer container `<div>` (flex column)
- 1 pulse ring `<div>` (positioned absolute)
- 1 bubble body `<div>` (with emoji text node)
- 1 tail `<div>` (CSS triangle)
- **Total: 4 elements per marker**

**Proposed per-marker DOM structure** (with snippet):
- Same 4 elements + 1 snippet `<div>` (with text node)
- **Total: 5 elements per marker** (+25% DOM node increase)

**At 200 markers**: 800 DOM elements → 1000 DOM elements. This is well within browser performance budgets. Modern browsers handle thousands of DOM nodes without issue. The critical factor is **layout/reflow frequency**, not node count.

#### Rendering Pipeline Impact

The Azure Maps `HtmlMarkerManager` updates marker positions via CSS `transform` on the marker container during pan/zoom. This does **not** trigger layout/reflow for child elements — `transform` is a compositor-only property. Adding text inside the marker does not affect pan/zoom performance because:
1. The text div has fixed `max-width` and `overflow: hidden` — no dynamic layout needed.
2. The `white-space: nowrap` prevents line-breaking recalculation.
3. The text is static content (set once, not updated during pan/zoom).

**Marker creation/destruction** is the main bottleneck. The current code calls `map.markers.clear()` then re-adds all markers on every render cycle. Adding a slightly longer `htmlContent` string (the snippet div) increases parse time marginally. For 200 markers, the difference between a 200-char and 300-char HTML string is negligible (microseconds per marker × 200 = sub-millisecond total).

#### Comparison with SymbolLayer Text Labels

| Factor | HtmlMarker + text div | SymbolLayer with `textField` |
|--------|:---:|:---:|
| **Rendering engine** | DOM (CPU-composited) | WebGL (GPU-rendered) |
| **Collision avoidance** | Manual (or none) | Built-in (`allowOverlap` option) |
| **Performance at 200 pts** | Excellent | Excellent |
| **Performance at 1000+ pts** | Degraded (DOM thrashing) | Excellent (batched GPU draw) |
| **Text styling** | Full CSS (any font, size, shadow, etc.) | Limited (`TextOptions`: font, size, color, halo, offset) |
| **Custom shapes** | Any HTML/CSS (speech bubbles, etc.) | Icon images only (SVG/PNG via `imageSprite`) |
| **Integration effort** | Zero (existing pipeline) | Major refactor (replace HtmlMarker pipeline with Layer-based rendering) |

**Verdict**: For the current scale (≤200 markers), HtmlMarker with text is well within performance limits. A SymbolLayer migration would only be justified at 500+ markers, and would require abandoning the speech-bubble HTML design entirely (SymbolLayer renders pre-rasterized icon images, not live DOM). This is **not recommended** for this feature.

#### Benchmark Estimate

| Scenario | DOM Elements | Expected Render Time | Assessment |
|----------|:---:|:---:|:---:|
| 50 solo pins with snippets | ~250 | <100ms | Well under SC-003 (500ms) |
| 100 solo pins with snippets | ~500 | <200ms | Passes |
| 200 solo pins with snippets | ~1000 | <350ms | Passes |
| 200 pins + page scrolling + animations | ~1000 | <500ms | Marginal — monitor in testing |

### Decision

**Adding a text div to each HtmlMarker has negligible performance impact at the expected scale (50–200 markers).** No architectural changes or layer migration needed.

### Mitigation for Future Scale

If marker count grows beyond 200 in future features:
1. **Viewport culling**: Only render markers visible in the current map viewport (the custom `computeClusters` function already operates on all posts — adding a bounding-box filter would reduce the set).
2. **Marker pooling**: Reuse DOM elements via `marker.setOptions()` instead of `map.markers.clear()` + re-add. This avoids DOM creation/destruction overhead.
3. **SymbolLayer migration**: As a last resort, migrate to SymbolLayer for label rendering at 500+ markers. This is a separate feature and not in scope for 004.

---

## Summary of Decisions

| # | Question | Decision | Key Rationale |
|---|----------|----------|---------------|
| 1 | HtmlMarker text rendering | Fully supported; standard DOM text inside `htmlContent` | No Azure Maps-specific constraints; text renders via browser's DOM engine |
| 2 | CSS truncation (inline) | `max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap` | Standard CSS truncation works fully in inline styles; combined with JS pre-truncation for belt-and-suspenders |
| 3 | Snippet positioning | **Below the tail**, centered | Natural top-down flow; no layout changes; no `pixelOffset` adjustment; minimal horizontal spread |
| 4 | JS text truncation | Word-boundary cut at 40 chars with "…" | Clean word breaks; whitespace normalization; hard-cut fallback for edge cases |
| 5 | Performance | Negligible impact at ≤200 markers; no migration needed | +1 DOM element per marker; static text with fixed layout; CSS transform repositioning unaffected |

## Implementation Approach

The `buildSpeechBubbleHtml()` function gains one parameter:

```typescript
function buildSpeechBubbleHtml(
  emoji: string,
  bgColor: string,
  tailColor: string,
  ringColor: string,
  pinSize: number,
  opacity: number,
  snippetText: string,  // NEW — pre-truncated via truncateSnippet()
): string {
  // ... existing bubble + tail HTML ...
  // Append snippet div only if snippetText is non-empty:
  + (snippetText
    ? `<div style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#374151;text-align:center;line-height:1.2;margin-top:2px;pointer-events:none;opacity:${opacity}">${snippetText}</div>`
    : '')
  // ... close outer container ...
}
```

The `renderMarkers()` callback passes `truncateSnippet(post.text)` for solo pins; for clusters, it passes the newest post's snippet + `moreCount`. Dimmed pins/clusters pass empty strings.

---

## Question 6: Cluster Snippet Preview Design

### Context

The current cluster marker shows only a numeric count badge (e.g., "3"). Users must tap it to see a `ClusterListPanel` and discover what's inside. The spec now requires showing the **newest post's snippet + "+N more"** on the cluster marker itself, so users get a glanceable preview.

### Approaches Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| **Newest-first snippet + "+N more"** | Shows the freshest & most relevant content; simple to implement (sort by `createdAt`, take first) | Only previews 1 post out of N |
| **Show 2-3 snippets stacked** | More content visible at a glance | Tall marker, high occlusion risk, cluttered on dense maps |
| **Rotating snippet (animated)** | Shows all content over time | Distracting animation; violates 6.4 Lightweight Visualization; impossible to scan quickly |
| **Category summary** (e.g., "2 Questions, 1 Meetup") | Content-type at a glance | Doesn't reveal actual text; less useful for deciding whether to tap |

### Decision: **Newest-first snippet + "+N more" label**

### Rationale

1. **Freshness = relevance**: LinkUp's content is ephemeral (TTL-based). The newest post in a cluster is most likely to be active/relevant. Showing its snippet maximizes the chance that the glanceable preview is useful.
2. **Minimal vertical growth**: One snippet line (~15px) + one "+N more" line (~12px) adds ~27px to the cluster marker height. This is modest compared to stacking 2-3 snippets (~45-60px).
3. **Consistent with solo pins**: Same truncation logic (`truncateSnippet()`) and same visual styling (11px gray text below the marker body). The cluster marker just has the count badge above and the snippet + "+N more" below.
4. **ClusterListPanel remains the full-detail path**: The snippet preview is a teaser; the full chronological list is accessible on click (existing behavior unchanged).

### Cluster Marker Layout (proposed)

```
         ┌──────────────┐
         │      3       │  ← Cluster count badge (existing)
         └──────────────┘
     "Anyone want to grab…"  ← Newest post's snippet (max-width: 120px)
          +2 more            ← Remaining count (small, gray, italic)
```

### Implementation Sketch

`buildClusterHtml()` gains two parameters:

```typescript
function buildClusterHtml(
  count: number,
  isHighlighted: boolean,
  isDimmed: boolean,
  snippetText: string,   // NEW — truncated text of newest post
  moreCount: number,     // NEW — count - 1
): string {
  // ... existing badge circle ...
  // After badge, append:
  + (snippetText && !isDimmed
    ? `<div style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#374151;text-align:center;line-height:1.2;margin-top:4px">${snippetText}</div>`
    + (moreCount > 0
      ? `<div style="font-size:10px;color:#9ca3af;text-align:center;font-style:italic;margin-top:1px">+${moreCount} more</div>`
      : '')
    : '')
}
```

In `renderMarkers()`, for cluster groups:

```typescript
// Sort cluster posts newest-first, take first for snippet
const sorted = [...clusterMembers].sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
);
const newestText = truncateSnippet(sorted[0].text);
const moreCount = sorted.length - 1;
```

### "+N more" Styling

- Font: 10px, gray-400 (#9ca3af), italic — visually subordinate to the snippet
- Non-clickable (pointer-events: none) — click still opens ClusterListPanel
- Hidden when cluster is dimmed (search non-match) for consistency

---

## Question 7: Snippet Occlusion Avoidance

### Context

Solo pins outside the 50px clustering radius can still be close enough that their text snippets (max-width 120px, centered below the pin) visually overlap each other or cover a neighboring pin's bubble. The spec requires detecting and resolving these collisions.

### Approaches Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| **Post-render collision detection (DOM-based)** | Exact bounding boxes via `getBoundingClientRect()` | Requires a two-pass render (render → measure → hide → re-render); DOM measurement forces layout thrash; complex async logic |
| **Pixel-space bounding-box estimation** | Fast (no DOM access); uses same `positionsToPixels()` as clustering; can run in the existing `renderMarkers()` single pass | Estimated boxes (not pixel-perfect); off by a few pixels for variable-length text |
| **SymbolLayer `allowOverlap: false`** | Built-in collision avoidance | Requires migrating away from HtmlMarker; massive scope increase; rejected in Q5 |
| **Increase clustering radius** | Fewer solo pins → fewer collisions | Over-clusters; hides distinct posts that are nearby but not overlapping |

### Decision: **Pixel-space bounding-box estimation (greedy, newest-first priority)**

### Algorithm

After `computeClusters()` produces solo pins, and before creating HtmlMarkers:

1. **Convert all solo pin positions to pixel coordinates** (already done by `computeClusters`).
2. **Sort solo pins by `createdAt` descending** (newest first — same priority as cluster snippet selection).
3. **For each pin, estimate the snippet bounding box** in pixel space:
   - Center: pin's pixel position
   - Width: 120px (max-width of snippet)
   - Height: ~18px (11px font + 2px margin + padding)
   - Vertical offset: ~40px below pin center (bubble height + tail + gap)
   - So the snippet rect is roughly: `[px - 60, py + 22, px + 60, py + 40]` (left, top, right, bottom)
4. **Greedy placement**: iterate newest-first. For each pin:
   - Check if the snippet rect overlaps any **previously placed snippet rect** OR any **pin bubble rect** (of any solo pin or cluster marker).
   - If no overlap → show snippet, add rect to "occupied" set.
   - If overlap → hide snippet for this pin (set `snippetText = ""`).
5. **Pin bubble bounding box estimate**: `[px - 24, py - 36, px + 24, py + 8]` (based on 48px bubble area centered at pin with offset).

### Complexity

- Uses the same grid-cell spatial index from `computeClusters()` (cell size = snippet width ≈ 120px).
- Each pin checks only neighboring cells → O(k) comparisons per pin where k is the average neighbors.
- Total: O(n·k), which for typical k ≤ 8 is effectively O(n).
- At 200 pins this adds < 1ms to the render cycle.

### Rationale for Greedy Newest-First

- **Consistency**: The same post that wins the cluster snippet preview (newest) also wins the occlusion competition for solo pins. Users see a consistent "freshest content first" heuristic.
- **Simplicity**: Greedy placement is trivial to implement and debug. Optimal placement (minimize hidden snippets) is NP-hard and unjustified for a map label feature.
- **Deterministic**: Given the same set of posts and viewport, the same snippets always win. No flickering or random selection.

### Edge Cases

- **Cluster markers also occupy space**: Cluster marker bounding boxes are added to the occupied set first (they always show), so solo pin snippets never overlap a cluster badge.
- **Dimmed pins**: Dimmed pins' snippets are hidden regardless of occlusion (they're hidden by the search-dim rule first), so they don't participate in the occlusion check and don't occupy space.
- **Zooming**: The occlusion pass runs on every `renderMarkers()` call (triggered by `moveend`/`zoomend`), so it automatically adapts to viewport changes.

### Implementation Sketch

```typescript
interface SnippetRect {
  left: number; top: number; right: number; bottom: number;
}

function rectsOverlap(a: SnippetRect, b: SnippetRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function computeSnippetVisibility(
  soloPins: { post: PostSummary; px: number; py: number }[],
  clusterRects: SnippetRect[],
): Set<string> {  // returns set of post IDs whose snippets should be shown
  // Sort newest-first
  const sorted = [...soloPins].sort(
    (a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
  );

  const occupied: SnippetRect[] = [...clusterRects];
  const visible = new Set<string>();

  // Also add all pin bubble rects (always visible)
  for (const pin of sorted) {
    occupied.push({
      left: pin.px - 24, top: pin.py - 36,
      right: pin.px + 24, bottom: pin.py + 8,
    });
  }

  for (const pin of sorted) {
    const snippetRect: SnippetRect = {
      left: pin.px - 60, top: pin.py + 22,
      right: pin.px + 60, bottom: pin.py + 40,
    };

    const hasCollision = occupied.some(r => rectsOverlap(snippetRect, r));
    if (!hasCollision) {
      visible.add(pin.post.id);
      occupied.push(snippetRect);
    }
  }

  return visible;
}
```

### Alternatives Rejected

- **DOM-based collision detection**: Too expensive (layout thrash) and requires async two-pass rendering. The pixel-estimation approach is fast and accurate enough.
- **Increase clustering radius to 120px**: Would over-cluster — posts 80px apart on screen are clearly separable and should remain as distinct pins. The user explicitly wants to see individual pins when they don't overlap.
- **Always show all snippets (ignore overlap)**: Directly violates SC-002 ("No text snippet overlaps another pin, snippet, or key UI element"). Not acceptable.

---

## Summary of Decisions (Updated)

| # | Question | Decision | Key Rationale |
|---|----------|----------|---------------|
| 1 | HtmlMarker text rendering | Fully supported; standard DOM text inside `htmlContent` | No Azure Maps-specific constraints |
| 2 | CSS truncation (inline) | `max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap` | Standard CSS; combined with JS pre-truncation |
| 3 | Snippet positioning | **Below the tail**, centered | Natural top-down flow; no layout changes needed |
| 4 | JS text truncation | Word-boundary cut at 40 chars with "…" | Clean word breaks; whitespace normalization |
| 5 | Performance | Negligible impact at ≤200 markers | +1-2 DOM elements per marker; static text |
| **6** | **Cluster snippet preview** | **Newest post's snippet + "+N more" label** | **Freshest content most relevant; consistent with solo snippet** |
| **7** | **Occlusion avoidance** | **Pixel-space bounding-box, greedy newest-first** | **O(n·k) efficiency; deterministic; no DOM measurement needed** |

- [Add HTML markers to the map](https://learn.microsoft.com/en-us/azure/azure-maps/map-add-custom-html) — official HtmlMarker guide; includes the critical note: *"the more HTML markers added to a page, the more DOM elements there are. Performance can degrade after adding a few hundred HTML markers."*
- [Add a symbol layer to a map](https://learn.microsoft.com/en-us/azure/azure-maps/map-add-pin) — SymbolLayer guide; notes *"Symbol layers are rendered using WebGL... the symbol layer renders a large number of point data on the map, with better performance [than HtmlMarker]."*
- [`atlas.HtmlMarker` API](https://learn.microsoft.com/en-us/javascript/api/azure-maps-control/atlas.htmlmarker) — class reference
- [`atlas.HtmlMarkerOptions`](https://learn.microsoft.com/en-us/javascript/api/azure-maps-control/atlas.htmlmarkeroptions) — `htmlContent`, `position`, `pixelOffset`
- [CSS `text-overflow`](https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow) — requires `overflow: hidden` + block container with width constraint
- [003-pin-category-icons research](../003-pin-category-icons/research.md) — prior art on speech-bubble HtmlMarker design and clustering approach
