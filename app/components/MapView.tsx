// T010: MapView client component with react-azure-maps
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { PostSummary, PostCategory } from "@/app/types";
import { CATEGORIES, DEFAULT_CATEGORY } from "@/app/lib/categories";
import PostPopup from "./PostPopup";
import ClusterListPanel from "./ClusterListPanel";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AtlasMap = any;
type AtlasMarker = any;

// NOTE: Geolocation is deferred to component mount (not module load)
// to avoid unexpected permission prompts during Next.js route prefetch.

/** T001: Truncate text to ~maxLen characters at a word boundary, appending "…" if needed. */
function truncateSnippet(text: string, maxLen = 40): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.lastIndexOf(" ", maxLen);
  // If no space found (single very long word), hard-cut at maxLen
  const end = cut > 0 ? cut : maxLen;
  return cleaned.slice(0, end) + "…";
}

/** T010: Build speech-bubble HtmlMarker HTML with CSS border-trick tail */
function buildSpeechBubbleHtml(
  emoji: string,
  bgColor: string,
  tailColor: string,
  ringColor: string,
  pinSize: number,
  opacity: number,
  snippetText: string = "",
): string {
  const ringSize = pinSize + 12;
  const fontSize = Math.round(pinSize * 0.45);
  return `<div style="cursor:pointer;opacity:${opacity};position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column">`
    + `<div style="position:absolute;top:0;width:${ringSize}px;height:${ringSize}px;border-radius:50%;background:${ringColor};animation:pulse-ring 2s ease-out infinite"></div>`
    + `<div style="min-width:${pinSize}px;height:${pinSize}px;border-radius:12px;background:linear-gradient(135deg,${bgColor},${bgColor}dd);border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;position:relative;z-index:1">${emoji}</div>`
    + `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${tailColor};margin-top:-3px;position:relative;z-index:1"></div>`
    + (snippetText
      ? `<div style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:500;color:#1f2937;text-align:center;line-height:1;margin-top:0px;pointer-events:none;background:#ffffff;padding:3px 8px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.18);border:1.5px solid rgba(0,0,0,0.08)">${snippetText}</div>`
      : '')
    + `</div>`;
}

/** T018: Build cluster marker HTML with numeric badge */
function buildClusterHtml(count: number, isHighlighted: boolean, isDimmed: boolean, snippetText: string = "", moreCount: number = 0): string {
  const size = count <= 5 ? 44 : count <= 20 ? 52 : 60;
  let bg = "linear-gradient(135deg, #6366f1, #8b5cf6)";
  let opacity = 1;
  if (isDimmed) {
    bg = "linear-gradient(135deg, #d1d5db, #d1d5db)";
    opacity = 0.35;
  } else if (isHighlighted) {
    bg = "linear-gradient(135deg, #fb923c, #f97316)";
  }
  return `<div style="cursor:pointer;opacity:${opacity};display:flex;align-items:center;justify-content:center;flex-direction:column">`
    + `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:white">${count}</div>`
    + (snippetText && !isDimmed
      ? `<div style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#374151;text-align:center;line-height:1.2;margin-top:4px">${snippetText}</div>`
        + (moreCount > 0
          ? `<div style="font-size:10px;color:#9ca3af;text-align:center;font-style:italic;margin-top:1px">+${moreCount} more</div>`
          : '')
      : '')
    + `</div>`;
}

/** Build the HTML string for the user-location pin marker */
function buildUserPinHtml(): string {
  return `<div style="cursor:default;display:flex;flex-direction:column;align-items:center">`
    + `<div style="width:32px;height:32px;border-radius:8px 8px 8px 0;background:linear-gradient(135deg,#3b82f6,#2563eb);border:3px solid white;box-shadow:0 3px 10px rgba(37,99,235,0.4);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center">`
    + `<span style="transform:rotate(45deg);font-size:14px;color:white;font-weight:bold">📍</span>`
    + `</div>`
    + `<div style="width:8px;height:8px;border-radius:50%;background:rgba(59,130,246,0.35);margin-top:2px;animation:pulse-ring 2s ease-out infinite"></div>`
    + `</div>`;
}

/** T016: Group nearby posts into clusters based on pixel distance */
function computeClusters(
  posts: PostSummary[],
  map: AtlasMap,
  radius: number,
): { center: [number, number]; posts: PostSummary[] }[] {
  if (posts.length === 0) return [];

  const positions = posts.map((p) => [p.lng, p.lat]);
  let pixels: number[][];
  try {
    pixels = map.positionsToPixels(positions);
  } catch {
    // Fallback: treat each post as its own cluster
    return posts.map((p) => ({ center: [p.lng, p.lat] as [number, number], posts: [p] }));
  }

  // Build a simple grid index in pixel space to avoid O(n²) all-pairs comparisons.
  const cellSize = radius;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < pixels.length; i++) {
    const x = pixels[i][0];
    const y = pixels[i][1];
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const key = `${cx},${cy}`;
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }

  const radiusSq = radius * radius;
  const used = new Set<number>();
  const groups: { center: [number, number]; posts: PostSummary[] }[] = [];

  for (let i = 0; i < posts.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const members = [i];

    const x = pixels[i][0];
    const y = pixels[i][1];
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);

    // Only compare against points in the same or neighboring grid cells.
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const key = `${gx},${gy}`;
        const bucket = grid.get(key);
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue; // ensure each pair is considered once
          if (used.has(j)) continue;
          const dx = x - pixels[j][0];
          const dy = y - pixels[j][1];
          if (dx * dx + dy * dy < radiusSq) {
            members.push(j);
            used.add(j);
          }
        }
      }
    }

    const memberPosts = members.map((idx) => posts[idx]);
    const avgLng = memberPosts.reduce((s, p) => s + p.lng, 0) / memberPosts.length;
    const avgLat = memberPosts.reduce((s, p) => s + p.lat, 0) / memberPosts.length;
    groups.push({ center: [avgLng, avgLat], posts: memberPosts });
  }

  return groups;
}

/** T006: Bounding rectangle for snippet occlusion detection */
interface SnippetRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** T006: Check if two rectangles overlap */
function rectsOverlap(a: SnippetRect, b: SnippetRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** T007: Compute which solo pins should show their snippets (greedy, newest-first) */
function computeSnippetVisibility(
  soloPins: { post: PostSummary; px: number; py: number }[],
  clusterRects: SnippetRect[],
): Set<string> {
  // Sort newest-first
  const sorted = [...soloPins].sort(
    (a, b) => new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
  );

  const occupied: SnippetRect[] = [...clusterRects];

  // Add all pin bubble rects (always visible)
  for (const pin of sorted) {
    occupied.push({
      left: pin.px - 24,
      top: pin.py - 36,
      right: pin.px + 24,
      bottom: pin.py + 8,
    });
  }

  const visible = new Set<string>();

  for (const pin of sorted) {
    const snippetRect: SnippetRect = {
      left: pin.px - 60,
      top: pin.py + 22,
      right: pin.px + 60,
      bottom: pin.py + 40,
    };

    const hasCollision = occupied.some((r) => rectsOverlap(snippetRect, r));
    if (!hasCollision) {
      visible.add(pin.post.id);
      occupied.push(snippetRect);
    }
  }

  return visible;
}

interface MapViewProps {
  posts: PostSummary[];
  searchResultPostIds: Set<string> | null;
  currentUserId?: string;
  onMapClick: (lat: number, lng: number) => void;
  onViewportChange: (
    swLat: number,
    swLng: number,
    neLat: number,
    neLng: number
  ) => void;
}

export default function MapView({
  posts,
  searchResultPostIds,
  currentUserId,
  onMapClick,
  onViewportChange,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<AtlasMap | null>(null);
  const markersRef = useRef<AtlasMarker[]>([]);
  const userLocationMarkerRef = useRef<AtlasMarker | null>(null);
  const userCoordsRef = useRef<{ lng: number; lat: number } | null>(null);
  const markerClickedRef = useRef(false);
  const postsRef = useRef<PostSummary[]>(posts);
  const searchRef = useRef<Set<string> | null>(searchResultPostIds);
  const [selectedPost, setSelectedPost] = useState<PostSummary | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [clusterPosts, setClusterPosts] = useState<PostSummary[] | null>(null);

  // Keep refs in sync with latest props
  postsRef.current = posts;
  searchRef.current = searchResultPostIds;

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const placeUserPin = (map: AtlasMap, lng: number, lat: number) => {
      const atlas = (window as any).atlas;
      if (!atlas) return;
      if (userLocationMarkerRef.current) {
        map.markers.remove(userLocationMarkerRef.current);
      }
      const userMarker = new atlas.HtmlMarker({
        position: [lng, lat],
        htmlContent: buildUserPinHtml(),
        pixelOffset: [0, -24],
      });
      map.markers.add(userMarker);
      userLocationMarkerRef.current = userMarker;
    };

    // Initialize map immediately with fallback center, then recenter
    // + place pin once geolocation resolves (avoids blocking on permission prompt).
    const initMap = async () => {
      // Wait for Azure Maps SDK to load, but don't poll forever.
      const atlas = await new Promise<any | null>((resolve) => {
        const maxWaitMs = 10000; // 10s cap to avoid unbounded polling
        const startTime = Date.now();

        const check = () => {
          const a = (window as any).atlas;
          if (a) {
            resolve(a);
            return;
          }

          if (Date.now() - startTime >= maxWaitMs) {
            // Give up after maxWaitMs; caller must handle null.
            resolve(null);
            return;
          }

          setTimeout(check, 100);
        };

        check();
      });

      // If the SDK never became available, abort map init.
      if (!atlas) return;
      if (!mapRef.current) return;

      // Start with fallback center; recenter once geolocation arrives.
      const map = new atlas.Map(mapRef.current!, {
        center: [-122.1215, 47.6740], // Fallback: Redmond, WA
        zoom: 12,
        language: "en-US",
        authOptions: {
          authType: atlas.AuthenticationType.subscriptionKey,
          subscriptionKey: process.env.NEXT_PUBLIC_AZURE_MAPS_KEY ?? "",
        },
      });

      // Request geolocation at component mount (deferred from module load)
      // and recenter/pin when coords arrive — doesn't block map rendering.
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = { lng: pos.coords.longitude, lat: pos.coords.latitude };
            userCoordsRef.current = coords;
            map.setCamera({
              center: [coords.lng, coords.lat],
              zoom: 14,
              type: "ease",
              duration: 1000,
            });
            placeUserPin(map, coords.lng, coords.lat);
          },
          () => { /* Permission denied or error — keep fallback center */ },
          { enableHighAccuracy: false, maximumAge: 60000 }
        );
      }

      map.events.add("ready", () => {

        // Map click → create post (only if not clicking a marker)
        map.events.add("click", (e: any) => {
          if (e.shapes && e.shapes.length > 0) return;
          if (markerClickedRef.current) {
            markerClickedRef.current = false;
            return;
          }
          if (e.position) {
            onMapClick(e.position[1], e.position[0]);
          }
        });

        // Viewport change → load posts for visible area
        const fireViewport = () => {
          const bounds = map.getCamera().bounds;
          if (bounds) {
            const b = bounds;
            onViewportChange(
              atlas.data.BoundingBox.getSouth(b),
              atlas.data.BoundingBox.getWest(b),
              atlas.data.BoundingBox.getNorth(b),
              atlas.data.BoundingBox.getEast(b)
            );
          }
        };

        map.events.add("moveend", fireViewport);
        map.events.add("zoomend", fireViewport);

        // T019: Re-render markers on move/zoom for clustering updates
        map.events.add("moveend", () => renderMarkers());
        map.events.add("zoomend", () => renderMarkers());
        // T023: Auto-close cluster list panel on map movement
        map.events.add("movestart", () => setClusterPosts(null));

        // Initial viewport fetch — fires immediately for user's actual location
        fireViewport();

        // Ensure an initial marker render once the map is ready
        renderMarkers();
      });

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.dispose();
        mapInstanceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // T016-T024: Render markers with proximity-based clustering
  const renderMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const atlas = (window as any).atlas;
    if (!atlas) return;

    const currentPosts = postsRef.current;
    const currentSearch = searchRef.current;

    // Remove old markers
    markersRef.current.forEach((m: any) => map.markers.remove(m));
    markersRef.current = [];

    // T016: Compute clusters from pixel proximity (radius=50px)
    const groups = computeClusters(currentPosts, map, 50);

    // T008: Compute snippet occlusion visibility for solo pins
    const soloPinData: { post: PostSummary; px: number; py: number }[] = [];
    const clusterRects: SnippetRect[] = [];

    for (const group of groups) {
      if (group.posts.length === 1) {
        const post = group.posts[0];
        const isDimmed = currentSearch !== null && !currentSearch.has(post.id);
        // T009: Dimmed pins are excluded from occlusion (they don't occupy snippet space)
        if (!isDimmed) {
          try {
            const px = map.positionsToPixels([[post.lng, post.lat]]);
            if (px && px[0]) {
              soloPinData.push({ post, px: px[0][0], py: px[0][1] });
            }
          } catch { /* skip if pixel conversion fails */ }
        }
      } else {
        // Estimate cluster marker bounding box for occlusion
        try {
          const px = map.positionsToPixels([group.center]);
          if (px && px[0]) {
            const size = group.posts.length <= 5 ? 44 : group.posts.length <= 20 ? 52 : 60;
            const half = size / 2;
            clusterRects.push({
              left: px[0][0] - half,
              top: px[0][1] - half,
              right: px[0][0] + half,
              bottom: px[0][1] + half,
            });
          }
        } catch { /* skip */ }
      }
    }

    const visibleSnippets = computeSnippetVisibility(soloPinData, clusterRects);

    groups.forEach((group) => {
      if (group.posts.length === 1) {
        // Single post → speech-bubble marker
        const post = group.posts[0];
        const category: PostCategory = post.category;
        const catDef = CATEGORIES[category];

        const isSearchResult =
          currentSearch === null || currentSearch.has(post.id);
        const isDimmed = currentSearch !== null && !currentSearch.has(post.id);

        const pinSize = isSearchResult && currentSearch !== null ? 44 : 36;
        const emoji = catDef.emoji;
        let bgColor = catDef.color;
        let tailColor = catDef.tailColor;
        let ringColor = catDef.colorLight;
        let opacity = 1;

        if (isDimmed) {
          bgColor = "#d1d5db";
          tailColor = "#d1d5db";
          ringColor = "transparent";
          opacity = 0.35;
        } else if (currentSearch !== null) {
          bgColor = "#fb923c";
          tailColor = "#fb923c";
          ringColor = "rgba(251,146,60,0.3)";
        }

        // T003+T008+T009: Solo-pin snippet with occlusion and dimming
        const snippetText = isDimmed ? "" : (visibleSnippets.has(post.id) ? truncateSnippet(post.text) : "");
        const htmlContent = buildSpeechBubbleHtml(emoji, bgColor, tailColor, ringColor, pinSize, opacity, snippetText);

        const marker = new atlas.HtmlMarker({
          position: [post.lng, post.lat],
          htmlContent,
          pixelOffset: [0, -28],
        });

        map.events.add("click", marker, (e: any) => {
          markerClickedRef.current = true;
          if (e) e.preventDefault?.();
          setClusterPosts(null);
          setSelectedPost(post);
          const pixel = map.positionsToPixels([[post.lng, post.lat]]);
          if (pixel && pixel[0]) {
            setPopupPosition({ x: pixel[0][0], y: pixel[0][1] });
          }
        });

        map.markers.add(marker);
        markersRef.current.push(marker);
      } else {
        // T018+T021+T024: Cluster marker
        const clusterMembers = group.posts;
        // T024: Highlight cluster if ANY contained post matches search
        const anyMatch = currentSearch !== null &&
          clusterMembers.some((p) => currentSearch.has(p.id));
        const allMiss = currentSearch !== null && !anyMatch;
        const isHighlighted = currentSearch !== null && anyMatch;
        const isDimmed = allMiss;

        // T005: Sort cluster members newest-first and derive snippet
        const sorted = [...clusterMembers].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const clusterSnippet = isDimmed ? "" : truncateSnippet(sorted[0].text);
        const moreCount = sorted.length - 1;

        const htmlContent = buildClusterHtml(clusterMembers.length, isHighlighted, isDimmed, clusterSnippet, moreCount);

        const marker = new atlas.HtmlMarker({
          position: group.center,
          htmlContent,
        });

        // T021: Cluster click → open ClusterListPanel
        map.events.add("click", marker, (e: any) => {
          markerClickedRef.current = true;
          if (e) e.preventDefault?.();
          setSelectedPost(null);
          setPopupPosition(null);
          setClusterPosts(clusterMembers);
        });

        map.markers.add(marker);
        markersRef.current.push(marker);
      }
    });

    // Ensure user location pin exists if we have coordinates.
    // The user marker is managed separately from post markers and is not
    // removed by the loop above, so just re-add it when it's missing.
    const uc = userCoordsRef.current;
    if (uc && !userLocationMarkerRef.current) {
      const userMarker = new atlas.HtmlMarker({
        position: [uc.lng, uc.lat],
        htmlContent: buildUserPinHtml(),
        pixelOffset: [0, -24],
      });
      map.markers.add(userMarker);
      userLocationMarkerRef.current = userMarker;
    } else if (uc && userLocationMarkerRef.current) {
      // Re-add if it was removed (e.g. by map internals)
      try { map.markers.add(userLocationMarkerRef.current); } catch { /* already on map */ }
    }
  }, []);

  // Re-render markers when posts or search results change
  useEffect(() => {
    renderMarkers();
  }, [posts, searchResultPostIds, renderMarkers]);

  const handleClosePopup = useCallback(() => {
    setSelectedPost(null);
    setPopupPosition(null);
  }, []);

  const handleEngagementUpdate = useCallback(
    (postId: string, interestedCount: number, joinCount: number) => {
      // Update local post state
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost({
          ...selectedPost,
          interestedCount,
          joinCount,
        });
      }
    },
    [selectedPost]
  );

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />

      {/* Empty state */}
      {posts.length === 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 zenly-card px-5 py-3 text-sm text-gray-400 z-10 zenly-bounce">
          🗺️ No posts in this area yet
        </div>
      )}

      {/* Post Popup */}
      {selectedPost && (
        <div className="absolute top-0 right-0 h-full w-96 z-20 zenly-bounce">
          <PostPopup
            post={selectedPost}
            onClose={handleClosePopup}
            onEngagementUpdate={handleEngagementUpdate}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* T020+T022: Cluster List Panel */}
      {clusterPosts && !selectedPost && (
        <div className="absolute top-4 right-4 w-80 z-20 zenly-bounce">
          <ClusterListPanel
            posts={clusterPosts}
            onSelectPost={(post: PostSummary) => {
              setClusterPosts(null);
              setSelectedPost(post);
              const map = mapInstanceRef.current;
              if (map) {
                const pixel = map.positionsToPixels([[post.lng, post.lat]]);
                if (pixel && pixel[0]) {
                  setPopupPosition({ x: pixel[0][0], y: pixel[0][1] });
                }
              }
            }}
            onClose={() => setClusterPosts(null)}
          />
        </div>
      )}
    </div>
  );
}
