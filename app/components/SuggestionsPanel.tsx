// T035: SuggestionsPanel — "Copilot Suggestions" UI with categorized results + Action Hint
"use client";

import type { CombinedSuggestionsResponse } from "@/app/types";

interface SuggestionsPanelProps {
  suggestions: CombinedSuggestionsResponse | null;
  loading: boolean;
}

export default function SuggestionsPanel({
  suggestions,
  loading,
}: SuggestionsPanelProps) {
  if (loading) {
    return (
      <div className="pt-4">
        <div className="text-xs font-bold text-purple-400 mb-2">
          ✨ Copilot Suggestions
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          Loading suggestions...
        </div>
      </div>
    );
  }

  if (!suggestions) {
    return (
      <div className="pt-4">
        <div className="text-xs font-bold text-purple-400 mb-2">
          ✨ Copilot Suggestions
        </div>
        <p className="text-sm text-gray-300">No suggestions available</p>
      </div>
    );
  }

  const unavailableSources = new Set(suggestions.unavailableSources ?? []);
  const allEmpty =
    suggestions.m365.length === 0 &&
    suggestions.posts.length === 0 &&
    !suggestions.actionHint;

  if (allEmpty && unavailableSources.size === 0) {
    return (
      <div className="pt-4">
        <div className="text-xs font-bold text-purple-400 mb-2">
          ✨ Copilot Suggestions
        </div>
        <p className="text-sm text-gray-300">No suggestions available</p>
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="text-xs font-bold text-purple-400 mb-3">
        ✨ Copilot Suggestions
      </div>

      {/* Action Hint — FR-016: prominent placement at top */}
      {suggestions.actionHint && (
        <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-2xl">
          <p className="text-sm font-semibold text-purple-600">
            💡 {suggestions.actionHint}
          </p>
        </div>
      )}

      {/* === PRIMARY: M365 Internal Resources === */}
      {(suggestions.m365.length > 0 || unavailableSources.has("m365")) && (
        <div className="mb-3">
          <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-2">
            M365 Internal Resources
          </div>
          {unavailableSources.has("m365") ? (
            <p className="text-xs text-orange-400 italic">M365 search unavailable</p>
          ) : (
            <ul className="space-y-1">
              {suggestions.m365.map((item, i) => {
                const icon = item.source === "sharepoint" ? "📋"
                  : item.source === "email" ? "📧" : "📁";
                return (
                  <li key={i}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {icon} {item.title}
                    </a>
                    <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Posts (semantic search results) */}
      {suggestions.posts.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-medium text-gray-500 mb-1">
            📌 Related Posts
          </h4>
          <ul className="space-y-1">
            {suggestions.posts.map((p) => (
              <li
                key={p.id}
                className="text-sm text-gray-700 bg-gray-50 rounded p-2"
              >
                <p className="line-clamp-2">{p.text}</p>
                <span className="text-xs text-gray-400 mt-0.5 block">
                  {p.interestedCount + p.joinCount} participants
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
