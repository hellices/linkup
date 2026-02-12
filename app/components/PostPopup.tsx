// T020 + T037 + T040 + T041 + T043: PostPopup component
// Shows post details, MCP suggestions, engagement buttons, TTL expiry handling
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { PostSummary, CombinedSuggestionsResponse } from "@/app/types";
import SuggestionsPanel from "./SuggestionsPanel";

interface PostPopupProps {
  post: PostSummary;
  onClose: () => void;
  onEngagementUpdate: (
    postId: string,
    interestedCount: number,
    joinCount: number
  ) => void;
  currentUserId?: string;
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h remaining`;
  if (hours > 0) return `${hours}h ${mins % 60}m remaining`;
  return `${mins}m remaining`;
}

export default function PostPopup({
  post,
  onClose,
  onEngagementUpdate,
  currentUserId,
}: PostPopupProps) {
  const { data: session } = useSession();
  const [suggestions, setSuggestions] =
    useState<CombinedSuggestionsResponse | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [engagementLoading, setEngagementLoading] = useState(false);

  const timeRemaining = getTimeRemaining(post.expiresAt);

  // Fetch suggestions (AbortController prevents duplicate in-flight requests under React Strict Mode)
  useEffect(() => {
    const controller = new AbortController();
    setSuggestionsLoading(true);

    fetch(`/api/posts/${post.id}/suggestions`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSuggestions(data);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return; // expected on cleanup
        // Graceful degrade
      })
      .finally(() => {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [post.id]);

  // Handle engagement
  const handleEngagement = useCallback(
    async (intent: "interested" | "join") => {
      if (!session) {
        alert("Please sign in to participate.");
        return;
      }
      setEngagementLoading(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/engagement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent }),
        });
        if (res.ok) {
          const data = await res.json();
          onEngagementUpdate(post.id, data.interestedCount, data.joinCount);
        }
      } catch {
        // silently fail
      } finally {
        setEngagementLoading(false);
      }
    },
    [session, post.id, onEngagementUpdate]
  );

  return (
    <div className="h-full bg-white/95 backdrop-blur-xl shadow-2xl overflow-y-auto rounded-l-3xl">
      {/* Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-xl px-5 py-4 flex items-center justify-between z-10 rounded-tl-3xl">
        <div className="text-xs font-semibold text-purple-400 bg-purple-50 px-3 py-1 rounded-full">
          ⏰ {timeRemaining}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Author */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
            {(post.authorName ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-700">{post.authorName}</div>
            <div className="text-xs text-gray-300">
              {new Date(post.createdAt).toLocaleString("en-US")}
            </div>
          </div>
        </div>

        {/* Post text */}
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50/80 rounded-2xl p-4">
          {post.text}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {post.tags.map((tag, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-gradient-to-r from-blue-50 to-purple-50 text-purple-500 rounded-full text-xs font-semibold"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Engagement buttons — hide for own posts */}
        {currentUserId && post.authorId === currentUserId ? (
          <div className="text-xs text-gray-300 text-center py-3 bg-gray-50 rounded-2xl font-medium">
            My post
            <span className="ml-3">👀 {post.interestedCount} · 🤝 {post.joinCount}</span>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => handleEngagement("interested")}
                disabled={engagementLoading || !session}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-100 text-sm text-gray-500 font-semibold hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                👀 Interested
                <span className="text-xs text-gray-300">({post.interestedCount})</span>
              </button>
              <button
                onClick={() => handleEngagement("join")}
                disabled={engagementLoading || !session}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 text-white text-sm font-bold hover:from-pink-500 hover:to-purple-600 disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg shadow-pink-200/40 transition-all active:scale-95"
              >
                🤝 Join
                <span className="text-xs text-pink-200">({post.joinCount})</span>
              </button>
            </div>

            {!session && (
              <p className="text-xs text-gray-300 text-center font-medium">
                Sign in to participate ✨
              </p>
            )}
          </>
        )}

        {/* MCP Suggestions */}
        <SuggestionsPanel
          suggestions={suggestions}
          loading={suggestionsLoading}
        />
      </div>
    </div>
  );
}
