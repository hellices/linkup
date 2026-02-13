// T020+T022: ClusterListPanel — chronological post list for cluster click
"use client";

import type { PostSummary, PostCategory } from "@/app/types";
import { CATEGORIES, DEFAULT_CATEGORY } from "@/app/lib/categories";

interface ClusterListPanelProps {
  posts: PostSummary[];
  onSelectPost: (post: PostSummary) => void;
  onClose: () => void;
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function ClusterListPanel({
  posts,
  onSelectPost,
  onClose,
}: ClusterListPanelProps) {
  // Sort newest first
  const sorted = [...posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden max-h-[420px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="text-sm font-bold text-gray-700">
          📍 {sorted.length} posts here
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 text-xs transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Post list */}
      <div className="overflow-y-auto flex-1">
        {sorted.map((post) => {
          const cat = CATEGORIES[((post.category as PostCategory) ?? DEFAULT_CATEGORY)];
          return (
            <button
              key={post.id}
              onClick={() => onSelectPost(post)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <span className="text-base flex-shrink-0 mt-0.5">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {post.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{post.authorName}</span>
                    <span>·</span>
                    <span>⏰ {getTimeRemaining(post.expiresAt)}</span>
                    <span>·</span>
                    <span
                      className="font-medium"
                      style={{ color: cat.color }}
                    >
                      {cat.label}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
