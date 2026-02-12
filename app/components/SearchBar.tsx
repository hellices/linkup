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
    <div className="flex-1 flex items-center bg-white/95 backdrop-blur-xl rounded-full shadow-lg shadow-black/5 overflow-hidden border border-white/50">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="🔍 What help do you need?"
        className="flex-1 px-5 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-gray-300"
        maxLength={200}
      />
      {query && (
        <button
          onClick={() => {
            setQuery("");
            onClear();
          }}
          className="px-2 text-gray-300 hover:text-gray-500 text-sm transition-colors"
        >
          ✕
        </button>
      )}
      <button
        onClick={handleSearch}
        disabled={searching}
        className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 transition-all rounded-full m-1"
      >
        {searching ? "..." : "Search"}
      </button>
    </div>
  );
}
