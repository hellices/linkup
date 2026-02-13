# Data Model: Pin Text Preview

**Feature**: 004-pin-text-preview  
**Date**: 2026-02-13  

## No New Entities

This feature introduces **no new data entities, database columns, or persisted state**. It is a purely client-side rendering enhancement that reads the existing `PostSummary.text` field and derives a display-only snippet for the map pin.

## Existing Entity Used

### PostSummary

The feature reads the `text` field from `PostSummary` (already fetched and available in the `MapView` component via the `posts` prop).

| Field | Type | Used By This Feature |
|-------|------|:---:|
| `id` | `string` | — |
| `text` | `string` | **YES** — source for snippet truncation |
| `lat` | `number` | — (already used for pin positioning) |
| `lng` | `number` | — (already used for pin positioning) |
| `category` | `PostCategory` | — (already used for pin styling) |
| `interestedCount` | `number` | — |
| `joinCount` | `number` | — |

## Derived Display Concept

### Snippet (not persisted)

A **snippet** is a truncated derivation of `PostSummary.text`, computed at render time and injected as HTML text into the map marker.

| Property | Description |
|----------|-------------|
| **Source** | `PostSummary.text` |
| **Max length** | ~40 characters (word-boundary truncation) |
| **Suffix** | "…" (U+2026) appended when truncated |
| **Rendering** | Inline HTML `<div>` inside the `HtmlMarker.htmlContent` string |
| **Visibility** | Visible only on solo (non-clustered) pins; hidden or dimmed on clustered/search-dimmed pins |
| **Persistence** | None — computed on every `renderMarkers()` call |

## State Transitions

No state transitions apply. The snippet text is derived from immutable post data and only changes when the pin transitions between solo/clustered/dimmed visual states (controlled by the existing `computeClusters()` and search-highlight logic).

| Pin State | Snippet Behavior |
|-----------|-----------------|
| Solo (no search active) | Visible at full opacity (if not occluded by a nearby snippet/pin) |
| Solo (search match) | Visible at full opacity |
| Solo (search non-match / dimmed) | Hidden (not rendered) |
| Solo (occluded by newer pin's snippet) | Hidden — newer pin wins |
| Clustered (no search active) | Newest post's snippet + "+N more" label shown below cluster badge |
| Clustered (search match — any post matches) | Snippet visible at full opacity |
| Clustered (search non-match — all dimmed) | Snippet hidden |

## Cluster Snippet Derivation

When multiple posts form a cluster:

1. Posts are sorted by `createdAt` **descending** (newest first)
2. The snippet is derived from `sorted[0].text` via `truncateSnippet()`
3. The `moreCount` is `sorted.length - 1`
4. If `moreCount === 0` (single post leaving a cluster), it becomes a solo pin instead

This matches the `ClusterListPanel` sort order (newest first), so the preview snippet is always the first item users would see if they tapped the cluster.
