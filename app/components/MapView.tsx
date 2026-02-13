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

/** T010: Build speech-bubble HtmlMarker HTML with CSS border-trick tail */
function buildSpeechBubbleHtml(
  emoji: string,
  bgColor: string,
  tailColor: string,
  ringColor: string,
  pinSize: number,
  opacity: number,
): string {
  const ringSize = pinSize + 12;
  const fontSize = Math.round(pinSize * 0.45);
  return `<div style="cursor:pointer;opacity:${opacity};position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column">`
    + `<div style="position:absolute;top:0;width:${ringSize}px;height:${ringSize}px;border-radius:50%;background:${ringColor};animation:pulse-ring 2s ease-out infinite"></div>`
    + `<div style="min-width:${pinSize}px;height:${pinSize}px;border-radius:12px;background:linear-gradient(135deg,${bgColor},${bgColor}dd);border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;position:relative;z-index:1">${emoji}</div>`
    + `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${tailColor};margin-top:-3px;position:relative;z-index:1"></div>`
    + `</div>`;
}

/** T018: Build cluster marker HTML with numeric badge */
function buildClusterHtml(count: number, isHighlighted: boolean, isDimmed: boolean): string {
  const size = count <= 5 ? 44 : count <= 20 ? 52 : 60;
  let bg = "linear-gradient(135deg, #6366f1, #8b5cf6)";
  let opacity = 1;
  if (isDimmed) {
    bg = "linear-gradient(135deg, #d1d5db, #d1d5db)";
    opacity = 0.35;
  } else if (isHighlighted) {
    bg = "linear-gradient(135deg, #fb923c, #f97316)";
  }
  return `<div style="cursor:pointer;opacity:${opacity};display:flex;align-items:center;justify-content:center">`
    + `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:white">${count}</div>`
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

  const used = new Set<number>();
  const groups: { center: [number, number]; posts: PostSummary[] }[] = [];

  for (let i = 0; i < posts.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const members = [i];

    for (let j = i + 1; j < posts.length; j++) {
      if (used.has(j)) continue;
      const dx = pixels[i][0] - pixels[j][0];
      const dy = pixels[i][1] - pixels[j][1];
      if (dx * dx + dy * dy < radius * radius) {
        members.push(j);
        used.add(j);
      }
    }

    const memberPosts = members.map((idx) => posts[idx]);
    const avgLng = memberPosts.reduce((s, p) => s + p.lng, 0) / memberPosts.length;
    const avgLat = memberPosts.reduce((s, p) => s + p.lat, 0) / memberPosts.length;
    groups.push({ center: [avgLng, avgLat], posts: memberPosts });
  }

  return groups;
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

    const tryInit = () => {
      const atlas = (window as any).atlas;
      if (!atlas) {
        // SDK not loaded yet, retry
        setTimeout(tryInit, 100);
        return;
      }

      const map = new atlas.Map(mapRef.current!, {
      center: [-122.1215, 47.6740], // Default fallback: Redmond, WA
      zoom: 12,
      language: "en-US",
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: process.env.NEXT_PUBLIC_AZURE_MAPS_KEY ?? "",
      },
    });

    // Move to user's current location via browser Geolocation API
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setCamera({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 14,
            type: "ease",
            duration: 1000,
          });
        },
        () => { /* Permission denied or error — keep default center */ },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    map.events.add("ready", () => {
      // Map click → create post (only if not clicking a marker)
      map.events.add("click", (e: any) => {
        // If the click target is an HTML marker, skip
        if (e.shapes && e.shapes.length > 0) return;
        if (markerClickedRef.current) {
          markerClickedRef.current = false;
          return;
        }
        if (e.position) {
          onMapClick(e.position[1], e.position[0]);
        }
      });

      // Viewport change → load posts
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

      // Initial viewport fetch
      setTimeout(fireViewport, 500);
    });

    mapInstanceRef.current = map;
    }; // end tryInit

    tryInit();

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

    groups.forEach((group) => {
      if (group.posts.length === 1) {
        // Single post → speech-bubble marker
        const post = group.posts[0];
        const category: PostCategory = (post.category as PostCategory) ?? DEFAULT_CATEGORY;
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

        const htmlContent = buildSpeechBubbleHtml(emoji, bgColor, tailColor, ringColor, pinSize, opacity);

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

        const htmlContent = buildClusterHtml(clusterMembers.length, isHighlighted, isDimmed);

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
