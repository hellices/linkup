// T036: SearchBar component with semantic search trigger
"use client";

import { useState, useCallback } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
}

export default function SearchBar({ onSearch, onClear }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      onClear();
      return;
    }
    setSearching(true);
    await onSearch(query.trim());
    setSearching(false);
  }, [query, onSearch, onClear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
      if (e.key === "Escape") {
        setQuery("");
        onClear();
      }
    },
    [handleSearch, onClear]
  );

  return (
    <div className="flex-1 flex items-center bg-white/90 backdrop-blur rounded-lg shadow overflow-hidden">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="🔍 포스트 검색 (semantic search)..."
        className="flex-1 px-4 py-2 text-sm bg-transparent focus:outline-none"
        maxLength={200}
      />
      {query && (
        <button
          onClick={() => {
            setQuery("");
            onClear();
          }}
          className="px-2 text-gray-400 hover:text-gray-600 text-sm"
        >
          ✕
        </button>
      )}
      <button
        onClick={handleSearch}
        disabled={searching}
        className="px-4 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 disabled:opacity-50"
      >
        {searching ? "..." : "Search"}
      </button>
    </div>
  );
}
