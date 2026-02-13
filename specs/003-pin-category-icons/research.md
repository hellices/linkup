# Research: Azure Maps Pin Category Icons & Clustering

**Feature**: 003-pin-category-icons  
**Date**: 2026-02-13  
**Scope**: Azure Maps Web SDK v3.x (`azure-maps-control` npm package) — HtmlMarker speech-bubble styling, clustering support, HtmlMarker vs SymbolLayer for clustering, and custom cluster rendering.

---

## Question 1: HtmlMarker Speech-Bubble Styling

### Context

The current [MapView.tsx](../../app/components/MapView.tsx) uses `atlas.HtmlMarker` with inline HTML/CSS to render **circular pin markers** containing an emoji. The spec requires replacing these with **speech-bubble shaped markers** — a rounded rectangle body with a downward-pointing tail, containing a category emoji and colored background.

### Approaches Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| **CSS border-trick tail** | Simplest, no external assets, wide browser support, purely CSS | Limited to triangular tails; the tail is a separate pseudo-element |
| **CSS `clip-path`** | Single element, smooth curves possible, modern | Slightly more complex path definition; clip-path clips the background so shadows require a wrapper |
| **Inline SVG background** | Pixel-perfect shape, single element, supports shadows natively | More verbose HTML string, harder to parameterize colors inline |

### Decision: **CSS border-trick for the tail + rounded `div` for the body**

### Rationale

- **Simplicity**: The speech bubble is a rounded rectangle + a triangular pointer. The CSS border-trick creates the triangle with zero external dependencies.
- **Parameterization**: The `HtmlMarker.htmlContent` is an inline HTML string. CSS variables or inline `style` attributes make it trivial to set `background-color` per category.
- **Performance**: No SVG parsing overhead. Pure CSS renders fastest for hundreds of DOM markers.
- **Existing pattern**: The current code already uses inline HTML/CSS in `htmlContent` — this approach is a natural extension.

### Recommended Code Pattern

```html
<div style="
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
">
  <!-- Pulse ring (optional, for highlighted state) -->
  <div style="
    position: absolute;
    width: 52px; height: 52px;
    border-radius: 50%;
    background: rgba(96,165,250,0.3);
    animation: pulse-ring 2s ease-out infinite;
  "></div>

  <!-- Speech bubble body -->
  <div style="
    min-width: 40px; height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, #818cf8, #818cf8dd);
    border: 3px solid white;
    box-shadow: 0 3px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    position: relative;
  ">💬</div>

  <!-- Tail (CSS border-trick triangle) -->
  <div style="
    width: 0; height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid #818cf8;
    margin-top: -3px;
  "></div>
</div>
```

Key design points:
- The **tail color** must match the bubble body's `background` — parameterized per category via `border-top` color.
- The `pixelOffset` on the HtmlMarker should be set to `[0, -28]` (approx half the total height) so the tail tip aligns with the geographic coordinate.
- The white `border` on the body creates visual separation from the map. The tail sits below and overlaps the border slightly (`margin-top: -3px`).
- **Minimum size**: FR-011 requires ≥32px; the 40px body + 8px tail = 48px total satisfies this.

### Alternatives Rejected

- **`clip-path: polygon(...)`**: Would produce a smoother single-element shape, but makes the white border impossible without a wrapper (clip-path clips borders too). Also makes the shadow require a `filter: drop-shadow()` on a parent, adding complexity.
- **Inline SVG**: More verbose and harder to generate dynamically in a template literal. Would be overkill for a simple rounded-rect + triangle shape.

---

## Question 2: Azure Maps Clustering Support

### Context

The spec requires merging overlapping pins into cluster markers (FR-012 through FR-018). Does `azure-maps-control` v3.x provide built-in clustering?

### Findings

**Yes — `DataSource` has built-in clustering.** The `atlas.source.DataSource` class accepts clustering options:

```javascript
var datasource = new atlas.source.DataSource(null, {
  cluster: true,           // Enable clustering
  clusterRadius: 45,       // Pixels — points within this radius are clustered
  clusterMaxZoom: 15,      // Disable clustering above this zoom level
  clusterMinPoints: 2,     // Minimum points to form a cluster (default: 2)
  clusterProperties: {     // Custom aggregate properties on clusters
    // e.g., count questions: ['+', ['case', ['==', ['get', 'category'], 'question'], 1, 0]]
  }
});
```

**Key `DataSource` clustering methods:**

| Method | Description |
|--------|-------------|
| `getClusterChildren(clusterId)` | Returns child features/sub-clusters at next zoom level |
| `getClusterExpansionZoom(clusterId)` | Returns the zoom level where the cluster breaks apart |
| `getClusterLeaves(clusterId, limit, offset)` | Returns all individual points in the cluster (paginated) |

**Cluster/uncluster behavior with zoom levels:**
- At zoom levels ≤ `clusterMaxZoom`, nearby points (within `clusterRadius` pixels) are merged into cluster features.
- Cluster features have properties: `cluster: true`, `cluster_id`, `point_count`, `point_count_abbreviated`.
- Zooming in past `clusterMaxZoom` shows all individual points.
- If two points are at identical coordinates, the cluster persists even at max zoom (aligns with spec edge case).

### Decision: **Use `DataSource` with `cluster: true`**

### Rationale

- Built-in, well-documented, zero additional dependencies.
- Handles zoom-level-based cluster/uncluster automatically.
- `clusterProperties` enables category-aware aggregation (e.g., counting posts per category within a cluster).
- `getClusterLeaves()` provides the exact API needed to populate the cluster list panel (FR-013, FR-014).
- `clusterRadius` maps directly to the spec's "overlapping area" proximity threshold.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| **Supercluster (npm)** | Additional dependency; Azure Maps DataSource already uses Supercluster internally under the hood |
| **Custom pixel-distance grouping** | Reinventing the wheel; DataSource clustering does exactly this |
| **No clustering (just z-index manipulation)** | Doesn't solve the "back pins unselectable" problem from the spec |

---

## Question 3: HtmlMarker vs SymbolLayer for Clustering

### Context

The app currently uses `atlas.HtmlMarker` (DOM-based rendering). Azure Maps `DataSource` clustering natively works with **layers** (`SymbolLayer`, `BubbleLayer`), which use WebGL rendering. Can HtmlMarker be used with DataSource clustering?

### Findings

**HtmlMarker cannot natively consume DataSource clustering.** From the Azure Maps docs:

> "HTML Markers do not connect to data sources. Instead position information is added directly to the marker and the marker is added to the maps `markers` property which is a `HtmlMarkerManager`."

However, there are **two proven approaches** to bridge HtmlMarker with DataSource clustering:

#### Option A: `HtmlMarkerLayer` (open-source module)

The [azure-maps-html-marker-layer](https://github.com/Azure-Samples/azure-maps-html-marker-layer) module provides an `HtmlMarkerLayer` class that:
- Extends `BubbleLayer` internally (to leverage DataSource integration).
- Accepts a `markerCallback` function: `(id, position, properties) => HtmlMarker | Promise<HtmlMarker>`.
- Automatically handles cluster features — the callback receives `properties.cluster === true` for cluster points.
- Manages marker lifecycle (add/remove from DOM as map moves).
- Supports click/hover events on the layer level.

**Usage pattern:**
```javascript
var datasource = new atlas.source.DataSource(null, { cluster: true, clusterRadius: 45 });
map.sources.add(datasource);

var markerLayer = new atlas.layer.HtmlMarkerLayer(datasource, null, {
  markerCallback: (id, position, properties) => {
    if (properties.cluster) {
      return new atlas.HtmlMarker({
        position: position,
        htmlContent: `<div class="cluster-marker">${properties.point_count}</div>`
      });
    }
    return new atlas.HtmlMarker({
      position: position,
      htmlContent: `<div class="category-pin">${properties.emoji}</div>`
    });
  }
});
map.layers.add(markerLayer);
```

**Concerns:**
- **Experimental**: The repo README states "this is an experimental library."
- **Last updated**: December 2020 (4+ years old), built against Azure Maps SDK v2.
- **Not on npm**: Must be vendored as a script or copied into the project.
- **SDK v2 vs v3**: Built against v2 API surface — may have compatibility issues with v3.

#### Option B: Custom clustering with manual HtmlMarker management (Recommended)

Use `DataSource` with `cluster: true` but **listen to map events and manually create/update HtmlMarkers** from the DataSource's rendered features. This is the same pattern shown in the Azure Maps docs' "Alternative solution" using Supercluster, but leveraging the built-in DataSource clustering instead.

**Pattern:**
```javascript
var datasource = new atlas.source.DataSource(null, {
  cluster: true,
  clusterRadius: 50,
  clusterMaxZoom: 18
});
map.sources.add(datasource);
// Add data to datasource...

function renderMarkers() {
  var cam = map.getCamera();
  // Query the datasource for features in the current view
  var shapes = datasource.toJson().features; // or use map.layers.getRenderedShapes()
  
  map.markers.clear();
  shapes.forEach(feature => {
    if (feature.properties.cluster) {
      // Render cluster marker
      var marker = new atlas.HtmlMarker({
        position: feature.geometry.coordinates,
        htmlContent: `<div class="cluster">${feature.properties.point_count}</div>`
      });
      map.markers.add(marker);
    } else {
      // Render individual pin
      var marker = new atlas.HtmlMarker({
        position: feature.geometry.coordinates,
        htmlContent: buildSpeechBubble(feature.properties)
      });
      map.markers.add(marker);
    }
  });
}

map.events.add('moveend', renderMarkers);
map.events.add('zoomend', renderMarkers);
```

### Decision: **Option B — Custom HtmlMarker management on top of DataSource clustering**

### Rationale

1. **No external dependency**: Avoids vendoring a 4-year-old experimental module that may not work with SDK v3.
2. **Full control**: The current `MapView.tsx` already manually manages HtmlMarkers (create, add, remove on post changes). The pattern is already established — we're adding cluster awareness to it.
3. **Simpler debugging**: No black-box layer abstraction; the marker lifecycle is explicit.
4. **Existing code alignment**: The current code uses `map.markers.add/remove` and manual event binding — this approach extends that pattern rather than replacing it.
5. **DataSource does the heavy lifting**: The clustering math (grouping, zoom-level-based dissolution) is handled by DataSource. We simply read the clustered output and render HtmlMarkers.

### Implementation Approach

The `MapView.tsx` refactor will:

1. **Add a `DataSource`** with `cluster: true` to the map.
2. **Populate the DataSource** with GeoJSON Point features (from `posts` prop), each carrying `category`, `postId`, and other metadata as properties.
3. **On `moveend`/`zoomend`/data change**, query the DataSource for rendered shapes (both clusters and individual points).
4. **Render HtmlMarkers** for each shape:
   - **Individual points** → speech-bubble pin with category emoji + color.
   - **Cluster points** → cluster marker with numeric badge.
5. **Attach click events** to each marker:
   - Individual markers → open PostPopup (existing behavior).
   - Cluster markers → open cluster list panel (new component).
6. **For cluster list panel**: Use `datasource.getClusterLeaves(clusterId, Infinity)` to get all posts in the cluster.

---

## Question 4: Custom Cluster Rendering

### Context

Cluster markers need to display a numeric badge (post count) with custom styling, and potentially show category composition. Can we use HTML rendering for cluster points?

### Findings

With the **Option B approach** (custom HtmlMarker management), cluster rendering is fully customizable because we control the `htmlContent` string.

**DataSource cluster features provide these properties:**

| Property | Type | Description |
|----------|------|-------------|
| `cluster` | `boolean` | `true` if this feature is a cluster |
| `cluster_id` | `number` | Unique ID for `getClusterLeaves()` / `getClusterExpansionZoom()` |
| `point_count` | `number` | Total points in cluster |
| `point_count_abbreviated` | `string` | Abbreviated count (e.g., "4K") |

**Custom `clusterProperties`** can aggregate category counts:
```javascript
var datasource = new atlas.source.DataSource(null, {
  cluster: true,
  clusterRadius: 50,
  clusterProperties: {
    questionCount: ['+', ['case', ['==', ['get', 'category'], 'question'], 1, 0]],
    discussionCount: ['+', ['case', ['==', ['get', 'category'], 'discussion'], 1, 0]],
    shareCount: ['+', ['case', ['==', ['get', 'category'], 'share'], 1, 0]],
    helpCount: ['+', ['case', ['==', ['get', 'category'], 'help'], 1, 0]],
    meetupCount: ['+', ['case', ['==', ['get', 'category'], 'meetup'], 1, 0]],
  }
});
```

This makes category counts available on each cluster feature's `properties`, enabling category-aware cluster rendering if needed in the future.

### Decision: **Custom HTML cluster markers via HtmlMarker `htmlContent`**

### Recommended Cluster Marker Pattern

```html
<div style="
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
">
  <!-- Cluster bubble -->
  <div style="
    width: 44px; height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: 3px solid white;
    box-shadow: 0 3px 12px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    color: white;
  ">${point_count}</div>
</div>
```

Design considerations:
- Cluster markers use a **circular shape** (distinct from speech-bubble individual pins) so users can visually differentiate clusters from posts.
- The numeric badge is centered inside the circle.
- The gradient and border follow the existing Zenly-light pastel design language.
- Size can scale with `point_count` (e.g., 44px for 2–5, 52px for 6–20, 60px for 20+).
- When search is active (FR-018): if any post in the cluster matches search results, the cluster gets the highlight color; otherwise dimmed.

### Cluster Click → List Panel Flow

```
User clicks cluster marker
  → Read cluster_id from marker properties
  → Call datasource.getClusterLeaves(cluster_id, Infinity)
  → Returns array of individual point Features with full properties
  → Sort by createdAt descending (newest first)
  → Render ClusterListPanel component with post summaries
  → User selects a post → open PostPopup
```

---

## Summary of Decisions

| # | Question | Decision | Key Rationale |
|---|----------|----------|---------------|
| 1 | Speech-bubble styling | CSS border-trick tail + rounded div body | Simplest, no deps, parameterizable per category |
| 2 | Clustering support | `DataSource` with `cluster: true` | Built-in, handles zoom levels, provides `getClusterLeaves()` |
| 3 | HtmlMarker vs SymbolLayer | Custom HtmlMarker management on DataSource | Full control, no experimental deps, matches existing code pattern |
| 4 | Custom cluster rendering | HTML cluster markers via `htmlContent` | Fully customizable, numeric badge + styling, category-aware aggregation available |

## Key API References

- [`atlas.HtmlMarker`](https://learn.microsoft.com/en-us/javascript/api/azure-maps-control/atlas.htmlmarker) — DOM-based marker with `htmlContent` customization
- [`atlas.HtmlMarkerOptions`](https://learn.microsoft.com/en-us/javascript/api/azure-maps-control/atlas.htmlmarkeroptions) — `position`, `htmlContent`, `pixelOffset`, `popup`
- [`atlas.source.DataSource`](https://learn.microsoft.com/en-us/javascript/api/azure-maps-control/atlas.source.datasource) — GeoJSON data source with clustering
- [`DataSourceOptions`](https://learn.microsoft.com/en-us/javascript/api/azure-maps-control/atlas.datasourceoptions) — `cluster`, `clusterRadius`, `clusterMaxZoom`, `clusterMinPoints`, `clusterProperties`
- [`DataSource.getClusterLeaves()`](https://learn.microsoft.com/en-us/javascript/api/azure-maps-control/atlas.source.datasource) — retrieve individual points from a cluster
- [`DataSource.getClusterExpansionZoom()`](https://learn.microsoft.com/en-us/javascript/api/azure-maps-control/atlas.source.datasource) — zoom level at which cluster breaks apart
- [Clustering point data in the Web SDK](https://learn.microsoft.com/en-us/azure/azure-maps/clustering-point-data-web-sdk) — official clustering guide
- [Add HTML markers to the map](https://learn.microsoft.com/en-us/azure/azure-maps/map-add-custom-html) — HtmlMarker customization guide
- [azure-maps-html-marker-layer](https://github.com/Azure-Samples/azure-maps-html-marker-layer) — experimental community module (evaluated, not recommended)
