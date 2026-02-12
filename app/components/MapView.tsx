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
  onMapClick,
  onViewportChange,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<AtlasMap | null>(null);
  const markersRef = useRef<AtlasMarker[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostSummary | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
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
      // Map click → create post
      map.events.add("click", (e: any) => {
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

      const markerEl = document.createElement("div");
      markerEl.style.width = isSearchResult && searchResultPostIds !== null ? "20px" : "16px";
      markerEl.style.height = isSearchResult && searchResultPostIds !== null ? "20px" : "16px";
      markerEl.style.borderRadius = "50%";
      markerEl.style.border = "2px solid white";
      markerEl.style.cursor = "pointer";
      markerEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

      if (isDimmed) {
        markerEl.style.backgroundColor = "#9ca3af";
        markerEl.style.opacity = "0.4";
      } else if (searchResultPostIds !== null) {
        markerEl.style.backgroundColor = "#f97316"; // highlight orange
        markerEl.style.transform = "scale(1.2)";
      } else {
        markerEl.style.backgroundColor = "#3b82f6"; // default blue
      }

      const marker = new atlas.HtmlMarker({
        position: [post.lng, post.lat],
        htmlContent: markerEl,
      });

      map.events.add("click", marker, () => {
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
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-lg px-4 py-2 shadow text-sm text-gray-500 z-10">
          이 지역에는 아직 포스트가 없습니다
        </div>
      )}

      {/* Post Popup */}
      {selectedPost && (
        <div className="absolute top-0 right-0 h-full w-96 z-20">
          <PostPopup
            post={selectedPost}
            onClose={handleClosePopup}
            onEngagementUpdate={handleEngagementUpdate}
          />
        </div>
      )}
    </div>
  );
}
