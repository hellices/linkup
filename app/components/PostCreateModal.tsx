// T015: PostCreateModal component
"use client";

import { useState, useCallback } from "react";
import { countSentences } from "@/app/lib/validation";
import type { PostSummary } from "@/app/types";

interface PostCreateModalProps {
  lat: number | null;
  lng: number | null;
  onCreated: (post: PostSummary) => void;
  onClose: () => void;
}

const TTL_OPTIONS = [
  { value: "1m", label: "1분 (데모)" },
  { value: "24h", label: "24시간" },
  { value: "72h", label: "72시간" },
  { value: "7d", label: "7일" },
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

  const sentenceCount = countSentences(text);
  const isOverLimit = sentenceCount > 3;
  const canSave = text.trim() && ttl && !isOverLimit && !saving;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">새 포스트</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Text input */}
        <div className="mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="3문장 이내로 질문/요청/링크를 작성하세요..."
            className={`w-full h-24 border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 ${
              isOverLimit
                ? "border-red-300 focus:ring-red-400"
                : "border-gray-200 focus:ring-blue-400"
            }`}
            maxLength={500}
          />
          <div
            className={`text-xs mt-1 ${
              isOverLimit ? "text-red-500 font-medium" : "text-gray-400"
            }`}
          >
            {sentenceCount}/3 문장
            {isOverLimit && " — 3문장 이내로 작성해 주세요"}
            <span className="float-right">{text.length}/500</span>
          </div>
        </div>

        {/* TTL selector */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            만료 시간 (TTL)
          </label>
          <div className="flex gap-2">
            {TTL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTtl(opt.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  ttl === opt.value
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags input */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            태그 (선택, 쉼표로 구분)
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="AKS, Entra, React..."
            className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Coordinates info */}
        <div className="mb-4 text-xs text-gray-400">
          📍{" "}
          {lat && lng
            ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            : "지도 중심점 사용"}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 text-sm text-red-500 bg-red-50 rounded-lg p-2">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
