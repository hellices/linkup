// T035: SuggestionsPanel — "Suggested via MCP" UI with categorized results + Action Hint
"use client";

import type { CombinedSuggestionsResponse, McpSuggestion } from "@/app/types";

interface SuggestionsPanelProps {
  suggestions: CombinedSuggestionsResponse | null;
  loading: boolean;
}

function CategorySection({
  title,
  items,
  unavailable,
}: {
  title: string;
  items: McpSuggestion[];
  unavailable: boolean;
}) {
  if (unavailable) {
    return (
      <div className="mb-3">
        <h4 className="text-xs font-medium text-gray-400 mb-1">{title}</h4>
        <p className="text-xs text-orange-400 italic">
          {title} unavailable
        </p>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-3">
      <h4 className="text-xs font-medium text-gray-500 mb-1">{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {item.title}
            </a>
            <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SuggestionsPanel({
  suggestions,
  loading,
}: SuggestionsPanelProps) {
  if (loading) {
    return (
      <div className="border-t pt-4">
        <div className="text-xs font-medium text-gray-400 mb-2">
          Suggested via MCP
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Loading suggestions...
        </div>
      </div>
    );
  }

  if (!suggestions) {
    return (
      <div className="border-t pt-4">
        <div className="text-xs font-medium text-gray-400 mb-2">
          Suggested via MCP
        </div>
        <p className="text-sm text-gray-400">No suggestions available</p>
      </div>
    );
  }

  const unavailableSources = new Set(suggestions.unavailableSources ?? []);
  const allEmpty =
    suggestions.docs.length === 0 &&
    suggestions.issues.length === 0 &&
    suggestions.posts.length === 0 &&
    !suggestions.actionHint;

  if (allEmpty && unavailableSources.size === 0) {
    return (
      <div className="border-t pt-4">
        <div className="text-xs font-medium text-gray-400 mb-2">
          Suggested via MCP
        </div>
        <p className="text-sm text-gray-400">No suggestions available</p>
      </div>
    );
  }

  return (
    <div className="border-t pt-4">
      <div className="text-xs font-semibold text-purple-600 mb-3">
        Suggested via MCP
      </div>

      {/* Action Hint — FR-016: prominent placement at top */}
      {suggestions.actionHint && (
        <div className="mb-3 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm font-medium text-purple-800">
            💡 {suggestions.actionHint}
          </p>
        </div>
      )}

      {/* Categorized results — FR-017 */}
      <CategorySection
        title="📄 Docs"
        items={suggestions.docs}
        unavailable={unavailableSources.has("docs")}
      />
      <CategorySection
        title="🐛 Issues"
        items={suggestions.issues}
        unavailable={unavailableSources.has("issues")}
      />

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
