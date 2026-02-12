// T015: PostCreateModal component
"use client";

import { useState, useCallback } from "react";
import type { PostSummary } from "@/app/types";

interface PostCreateModalProps {
  lat: number | null;
  lng: number | null;
  onCreated: (post: PostSummary) => void;
  onClose: () => void;
}

const TTL_OPTIONS = [
  { value: "1m", label: "1min (demo)" },
  { value: "24h", label: "24 hours" },
  { value: "72h", label: "72 hours" },
  { value: "7d", label: "7 days" },
] as const;

export default function PostCreateModal({
  lat,
  lng,
  onCreated,
  onClose,
}: PostCreateModalProps) {
  const [text, setText] = useState("");
  const [ttl, setTtl] = useState<string>("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = text.length;
  const isOverLimit = charCount > 300;
  const canSave = text.trim().length > 0 && ttl && !isOverLimit && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    setSaving(true);
    setError(null);

    // Use provided coords or default to Redmond center
    const postLat = lat ?? 47.674;
    const postLng = lng ?? -122.1215;

    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 5);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          lat: postLat,
          lng: postLng,
          ttl,
          tags: tagList.length > 0 ? tagList : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create post");
        setSaving(false);
        return;
      }

      const post: PostSummary = await res.json();
      onCreated(post);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }, [canSave, text, ttl, tags, lat, lng, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-xl rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md sm:mx-4 p-6 zenly-bounce">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">💬 New Post</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Text input */}
        <div className="mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a quick question, request, or link ✨"
            className={`w-full h-28 border-2 rounded-2xl p-4 text-sm resize-none focus:outline-none transition-colors ${
              isOverLimit
                ? "border-pink-300 focus:border-pink-400 bg-pink-50/50"
                : "border-gray-100 focus:border-purple-300 bg-gray-50/50"
            }`}
            maxLength={300}
          />
          <div
            className={`text-xs mt-1.5 text-right font-medium ${
              isOverLimit ? "text-pink-500" : "text-gray-300"
            }`}
          >
            {charCount}/300
            {isOverLimit && " — Please shorten a bit 🙏"}
          </div>
        </div>

        {/* TTL selector */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-400 mb-2 block">
            ⏰ How long should it be visible?
          </label>
          <div className="flex gap-2">
            {TTL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTtl(opt.value)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  ttl === opt.value
                    ? "bg-gradient-to-r from-blue-400 to-purple-400 text-white shadow-md shadow-purple-200/50 scale-105"
                    : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags input */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-400 mb-2 block">
            🏷️ Tags (optional)
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="AKS, Entra, React..."
            className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:border-purple-300 bg-gray-50/50 transition-colors"
          />
        </div>

        {/* Coordinates info */}
        <div className="mb-4 text-xs text-gray-300 font-medium">
          📍{" "}
          {lat && lng
            ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            : "Using map center"}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 text-sm text-pink-500 bg-pink-50 rounded-xl p-3 font-medium">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-gray-100 text-sm text-gray-400 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 text-white text-sm font-bold hover:from-pink-500 hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-pink-200/40 transition-all active:scale-95"
          >
            {saving ? "Saving..." : "Post 🚀"}
          </button>
        </div>
      </div>
    </div>
  );
}
