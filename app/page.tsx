// T005: Main page with full-screen map + search bar + FAB "+" button
"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import AuthButton from "@/app/components/AuthButton";
import SearchBar from "@/app/components/SearchBar";
import PostCreateModal from "@/app/components/PostCreateModal";
import type { PostSummary, SemanticSearchResponse } from "@/app/types";

const MapView = dynamic(() => import("@/app/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

export default function Home() {
  const { data: session } = useSession();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [searchResult, setSearchResult] =
    useState<SemanticSearchResponse | null>(null);
  const [searchIndex, setSearchIndex] = useState(0);
  const [focusPosition, setFocusPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [bbox, setBbox] = useState<{
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
  } | null>(null);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!session) {
        alert("Please sign in to create a post.");
        return;
      }
      setClickedCoords({ lat, lng });
      setShowCreateModal(true);
    },
    [session]
  );

  const handleViewportChange = useCallback(
    async (swLat: number, swLng: number, neLat: number, neLng: number) => {
      setBbox({ swLat, swLng, neLat, neLng });
      try {
        const params = new URLSearchParams({
          swLat: String(swLat),
          swLng: String(swLng),
          neLat: String(neLat),
          neLng: String(neLng),
        });
        const res = await fetch(`/api/posts?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts);
        }
      } catch {
        // silently fail on fetch error
      }
    },
    []
  );

  const handlePostCreated = useCallback(
    (newPost: PostSummary) => {
      setPosts((prev) => {
        // Avoid duplicate if already present
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [...prev, newPost];
      });
      setShowCreateModal(false);
      setClickedCoords(null);
    },
    []
  );

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResult(null);
        return;
      }
      if (!bbox) return;
      try {
        const params = new URLSearchParams({
          q: query,
          swLat: String(bbox.swLat),
          swLng: String(bbox.swLng),
          neLat: String(bbox.neLat),
          neLng: String(bbox.neLng),
        });
        const res = await fetch(`/api/search?${params}`);
        if (res.ok) {
          const data: SemanticSearchResponse = await res.json();
          setSearchResult(data);
          setSearchIndex(0);
          // Fly to first result
          if (data.posts.length > 0) {
            setFocusPosition({ lat: data.posts[0].lat, lng: data.posts[0].lng });
          }
        }
      } catch {
        // silently fail
      }
    },
    [bbox]
  );

  const handleClearSearch = useCallback(() => {
    setSearchResult(null);
    setSearchIndex(0);
    setFocusPosition(null);
  }, []);

  // Client-side TTL: remove expired posts every 30s so stale pins disappear
  useEffect(() => {
    const interval = setInterval(() => {
      setPosts((prev) => {
        const now = Date.now();
        const active = prev.filter(
          (p) => new Date(p.expiresAt).getTime() > now
        );
        return active.length !== prev.length ? active : prev;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative h-screen w-screen">
      {/* Map */}
      <MapView
        posts={posts}
        searchResultPostIds={
          searchResult
            ? new Set(searchResult.posts.map((p) => p.id))
            : null
        }
        currentUserId={session?.user?.id}
        focusPosition={focusPosition}
        onMapClick={handleMapClick}
        onViewportChange={handleViewportChange}
      />

      {/* Top bar: Search + Auth */}
      <div className="absolute top-4 left-4 right-4 flex items-center gap-3 z-10">
        <SearchBar onSearch={handleSearch} onClear={handleClearSearch} />
        <AuthButton />
      </div>

      {/* Search result info + navigation */}
      {searchResult && (
        <div className="absolute top-16 left-4 z-10 zenly-card px-4 py-2.5 text-sm zenly-bounce flex items-center gap-2">
          <span className="font-semibold text-purple-500">
            ✨ {searchResult.posts.length} found
          </span>
          {searchResult.outOfBounds > 0 && (
            <span className="text-gray-400">
              · {searchResult.outOfBounds} outside map
            </span>
          )}
          {searchResult.posts.length > 1 && (
            <div className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-2">
              <button
                onClick={() => {
                  const newIdx = (searchIndex - 1 + searchResult.posts.length) % searchResult.posts.length;
                  setSearchIndex(newIdx);
                  const p = searchResult.posts[newIdx];
                  setFocusPosition({ lat: p.lat, lng: p.lng });
                }}
                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-xs transition-colors"
              >
                ‹
              </button>
              <span className="text-xs text-gray-500 font-medium min-w-[3ch] text-center">
                {searchIndex + 1}/{searchResult.posts.length}
              </span>
              <button
                onClick={() => {
                  const newIdx = (searchIndex + 1) % searchResult.posts.length;
                  setSearchIndex(newIdx);
                  const p = searchResult.posts[newIdx];
                  setFocusPosition({ lat: p.lat, lng: p.lng });
                }}
                className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-xs transition-colors"
              >
                ›
              </button>
            </div>
          )}
          <button
            onClick={handleClearSearch}
            className="ml-2 text-pink-400 hover:text-pink-500 font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {/* FAB "+" button */}
      {session && (
        <button
          onClick={() => {
            setClickedCoords(null);
            setShowCreateModal(true);
          }}
          className="absolute bottom-8 right-8 z-10 w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white rounded-full shadow-lg shadow-pink-300/40 flex items-center justify-center text-3xl transition-all active:scale-90"
          title="New Post"
        >
          +
        </button>
      )}

      {/* Post Create Modal */}
      {showCreateModal && (
        <PostCreateModal
          lat={clickedCoords?.lat ?? null}
          lng={clickedCoords?.lng ?? null}
          onCreated={handlePostCreated}
          onClose={() => {
            setShowCreateModal(false);
            setClickedCoords(null);
          }}
        />
      )}
    </main>
  );
}
