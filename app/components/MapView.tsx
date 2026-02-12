// T010: MapView client component with react-azure-maps
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { PostSummary } from "@/app/types";
import PostPopup from "./PostPopup";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AtlasMap = any;
type AtlasMarker = any;

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
  const [selectedPost, setSelectedPost] = useState<PostSummary | null>(null);
  const [, setPopupPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

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
      center: [-122.1215, 47.6740], // Redmond, WA
      zoom: 12,
      language: "en-US",
      authOptions: {
        authType: atlas.AuthenticationType.subscriptionKey,
        subscriptionKey: process.env.NEXT_PUBLIC_AZURE_MAPS_KEY ?? "",
      },
    });

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

  // Update markers when posts or searchResultPostIds change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const atlas = (window as any).atlas;
    if (!atlas) return;

    // Remove old markers
    markersRef.current.forEach((m: any) => map.markers.remove(m));
    markersRef.current = [];

    // Create markers for each post
    posts.forEach((post) => {
      const isSearchResult =
        searchResultPostIds === null || searchResultPostIds.has(post.id);
      const isDimmed = searchResultPostIds !== null && !searchResultPostIds.has(post.id);

      const pinSize = isSearchResult && searchResultPostIds !== null ? 44 : 36;
      let bgColor = "#60a5fa"; // Zenly pastel blue
      let ringColor = "rgba(96,165,250,0.3)";
      let opacity = 1;
      let emoji = "💬";
      if (isDimmed) {
        bgColor = "#d1d5db";
        ringColor = "transparent";
        opacity = 0.35;
        emoji = "💬";
      } else if (searchResultPostIds !== null) {
        bgColor = "#fb923c"; // Zenly orange highlight
        ringColor = "rgba(251,146,60,0.3)";
        emoji = "🔍";
      }

      const htmlContent = `<div style="cursor:pointer;opacity:${opacity};position:relative;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;width:${pinSize + 12}px;height:${pinSize + 12}px;border-radius:50%;background:${ringColor};animation:pulse-ring 2s ease-out infinite"></div>
        <div style="width:${pinSize}px;height:${pinSize}px;border-radius:50%;background:linear-gradient(135deg,${bgColor},${bgColor}dd);border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:${pinSize * 0.4}px;animation:bounce-in 0.35s cubic-bezier(0.34,1.56,0.64,1)">${emoji}</div>
      </div>`;

      const marker = new atlas.HtmlMarker({
        position: [post.lng, post.lat],
        htmlContent,
      });

      map.events.add("click", marker, (e: any) => {
        // Stop propagation so map click (create post) doesn't fire
        markerClickedRef.current = true;
        if (e) e.preventDefault?.();
        setSelectedPost(post);
        const pixel = map.positionsToPixels([[post.lng, post.lat]]);
        if (pixel && pixel[0]) {
          setPopupPosition({ x: pixel[0][0], y: pixel[0][1] });
        }
      });

      map.markers.add(marker);
      markersRef.current.push(marker);
    });
  }, [posts, searchResultPostIds]);

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
    </div>
  );
}
