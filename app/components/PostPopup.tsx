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
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "만료됨";
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}일 ${hours % 24}시간 남음`;
  if (hours > 0) return `${hours}시간 ${mins % 60}분 남음`;
  return `${mins}분 남음`;
}

export default function PostPopup({
  post,
  onClose,
  onEngagementUpdate,
}: PostPopupProps) {
  const { data: session } = useSession();
  const [suggestions, setSuggestions] =
    useState<CombinedSuggestionsResponse | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  const timeRemaining = getTimeRemaining(post.expiresAt);

  // Check TTL expiry
  useEffect(() => {
    const checkExpiry = () => {
      if (new Date(post.expiresAt).getTime() <= Date.now()) {
        setExpired(true);
      }
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 5000);
    return () => clearInterval(interval);
  }, [post.expiresAt]);

  // Fetch suggestions
  useEffect(() => {
    let cancelled = false;
    setSuggestionsLoading(true);

    fetch(`/api/posts/${post.id}/suggestions`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setSuggestions(data);
        }
      })
      .catch(() => {
        // Graceful degrade
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });

    return () => {
      cancelled = true;
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

  if (expired) {
    return (
      <div className="h-full bg-white shadow-lg p-6 flex flex-col items-center justify-center">
        <p className="text-gray-500 text-lg mb-4">
          이 포스트는 만료되었습니다
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-white shadow-lg overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
        <div className="text-sm text-gray-500">{timeRemaining}</div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Author */}
        <div className="text-xs text-gray-400">
          {post.authorName} ·{" "}
          {new Date(post.createdAt).toLocaleString("ko-KR")}
        </div>

        {/* Post text */}
        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
          {post.text}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {post.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Engagement buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleEngagement("interested")}
            disabled={engagementLoading || !session}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            👀 Interested
            <span className="text-xs text-gray-400">
              ({post.interestedCount})
            </span>
          </button>
          <button
            onClick={() => handleEngagement("join")}
            disabled={engagementLoading || !session}
            className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            🤝 Join
            <span className="text-xs text-blue-200">({post.joinCount})</span>
          </button>
        </div>

        {!session && (
          <p className="text-xs text-gray-400 text-center">
            참여하려면 먼저 로그인해 주세요
          </p>
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
