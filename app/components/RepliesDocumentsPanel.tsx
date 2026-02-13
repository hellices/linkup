// T008+T009+T010: RepliesDocumentsPanel — stacked sections for Replies + Shared Documents
"use client";

import { useReducer, useState, useEffect, useCallback } from "react";
import type { Reply, SharedDocument, PaginatedResponse } from "@/app/types";

// ─── Replies Reducer (R2.1) ─────────────────────────────────────────

interface RepliesState {
  items: (Reply & { _optimistic?: boolean })[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  totalCount: number;
}

type RepliesAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: PaginatedResponse<Reply>; append: boolean }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "SUBMIT_OPTIMISTIC"; reply: Reply & { _optimistic: true } }
  | { type: "SUBMIT_SUCCESS"; tempId: string; reply: Reply }
  | { type: "SUBMIT_FAILURE"; tempId: string; error: string }
  | { type: "DELETE_SUCCESS"; replyId: string };

function repliesReducer(state: RepliesState, action: RepliesAction): RepliesState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS": {
      const newItems = action.append
        ? [...state.items, ...action.payload.items]
        : [...state.items.filter((r) => r._optimistic), ...action.payload.items];
      return {
        ...state,
        items: newItems,
        nextCursor: action.payload.nextCursor,
        hasMore: action.payload.hasMore,
        loading: false,
        // Use server totalCount on initial fetch; keep existing on append
        totalCount: action.append
          ? state.totalCount
          : (action.payload.totalCount ?? action.payload.items.length),
      };
    }
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    case "SUBMIT_OPTIMISTIC":
      return {
        ...state,
        items: [action.reply, ...state.items],
        submitting: true,
        error: null,
        totalCount: state.totalCount + 1,
      };
    case "SUBMIT_SUCCESS":
      return {
        ...state,
        items: state.items.map((r) =>
          r.id === action.tempId ? { ...action.reply, _optimistic: undefined } : r
        ),
        submitting: false,
      };
    case "SUBMIT_FAILURE":
      return {
        ...state,
        items: state.items.filter((r) => r.id !== action.tempId),
        submitting: false,
        error: action.error,
        totalCount: state.totalCount - 1,
      };
    case "DELETE_SUCCESS":
      return {
        ...state,
        items: state.items.filter((r) => r.id !== action.replyId),
        totalCount: state.totalCount - 1,
      };
    default:
      return state;
  }
}

const initialRepliesState: RepliesState = {
  items: [],
  nextCursor: null,
  hasMore: false,
  loading: true,
  submitting: false,
  error: null,
  totalCount: 0,
};

// ─── Shared Documents State ─────────────────────────────────────────

interface SharedDocsState {
  items: SharedDocument[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  totalCount: number;
}

// ─── Props ──────────────────────────────────────────────────────────

interface RepliesDocumentsPanelProps {
  postId: string;
  isExpired: boolean;
  currentUserId?: string;
  isAuthenticated: boolean;
  /** Set of shared-document URLs, used by parent for cross-referencing */
  onSharedUrlsChange?: (urls: Set<string>) => void;
  /** Callback when a new document is shared (to update parent state) */
  onDocumentShared?: () => void;
  /** Increment to trigger a refetch of shared documents without re-mounting */
  refetchDocsTrigger?: number;
}

export default function RepliesDocumentsPanel({
  postId,
  isExpired,
  currentUserId,
  isAuthenticated,
  onSharedUrlsChange,
  onDocumentShared,
  refetchDocsTrigger,
}: RepliesDocumentsPanelProps) {
  // ─── Replies state (useReducer for optimistic UI) ──────────────
  const [replies, dispatch] = useReducer(repliesReducer, initialRepliesState);
  const [replyText, setReplyText] = useState("");

  // ─── Shared Documents state ────────────────────────────────────
  const [sharedDocs, setSharedDocs] = useState<SharedDocsState>({
    items: [],
    nextCursor: null,
    hasMore: false,
    loading: true,
    totalCount: 0,
  });

  // ─── Fetch Replies (initial load) ──────────────────────────────
  useEffect(() => {
    dispatch({ type: "FETCH_START" });
    fetch(`/api/posts/${postId}/replies`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed to load replies")))
      .then((data: PaginatedResponse<Reply>) => {
        dispatch({ type: "FETCH_SUCCESS", payload: data, append: false });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_ERROR", error: String(err) });
      });
  }, [postId]);

  // ─── Fetch Shared Documents (initial load + refetch on trigger) ────────────────
  useEffect(() => {
    setSharedDocs((s) => ({ ...s, loading: true }));
    fetch(`/api/posts/${postId}/shared-documents`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed to load documents")))
      .then((data: PaginatedResponse<SharedDocument>) => {
        setSharedDocs({
          items: data.items,
          nextCursor: data.nextCursor,
          hasMore: data.hasMore,
          loading: false,
          totalCount: data.totalCount ?? data.items.length,
        });
        // Notify parent of shared URLs for duplicate prevention
        if (onSharedUrlsChange) {
          onSharedUrlsChange(new Set(data.items.map((d) => d.url)));
        }
      })
      .catch(() => {
        setSharedDocs((s) => ({ ...s, loading: false }));
      });
  }, [postId, onSharedUrlsChange, refetchDocsTrigger]);

  // ─── Load More Replies ─────────────────────────────────────────
  const loadMoreReplies = useCallback(() => {
    if (!replies.nextCursor || replies.loading) return;
    dispatch({ type: "FETCH_START" });
    fetch(`/api/posts/${postId}/replies?cursor=${replies.nextCursor}`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed")))
      .then((data: PaginatedResponse<Reply>) => {
        dispatch({ type: "FETCH_SUCCESS", payload: data, append: true });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_ERROR", error: String(err) });
      });
  }, [postId, replies.nextCursor, replies.loading]);

  // ─── Load More Shared Documents ────────────────────────────────
  const loadMoreDocs = useCallback(() => {
    if (!sharedDocs.nextCursor || sharedDocs.loading) return;
    setSharedDocs((s) => ({ ...s, loading: true }));
    fetch(`/api/posts/${postId}/shared-documents?cursor=${sharedDocs.nextCursor}`)
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed")))
      .then((data: PaginatedResponse<SharedDocument>) => {
        setSharedDocs((prev) => {
          const mergedItems = [...prev.items, ...data.items];
          if (onSharedUrlsChange) {
            onSharedUrlsChange(new Set(mergedItems.map((d) => d.url)));
          }
          return {
            items: mergedItems,
            nextCursor: data.nextCursor,
            hasMore: data.hasMore,
            loading: false,
            totalCount: prev.totalCount,
          };
        });
      })
      .catch(() => {
        setSharedDocs((s) => ({ ...s, loading: false }));
      });
  }, [postId, sharedDocs.nextCursor, sharedDocs.loading, onSharedUrlsChange]);

  // ─── Submit Reply (optimistic) ─────────────────────────────────
  const handleSubmitReply = useCallback(async () => {
    const trimmed = replyText.trim();
    if (!trimmed || trimmed.length > 500 || !isAuthenticated) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticReply: Reply & { _optimistic: true } = {
      id: tempId,
      postId,
      authorId: currentUserId ?? "",
      authorName: "You",
      text: trimmed,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };

    dispatch({ type: "SUBMIT_OPTIMISTIC", reply: optimisticReply });
    setReplyText("");

    try {
      const res = await fetch(`/api/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to send reply" }));
        dispatch({ type: "SUBMIT_FAILURE", tempId, error: err.error ?? "Failed to send reply" });
        setReplyText(trimmed); // Preserve input on failure (R2.3)
        return;
      }

      const reply: Reply = await res.json();
      dispatch({ type: "SUBMIT_SUCCESS", tempId, reply });
    } catch {
      dispatch({ type: "SUBMIT_FAILURE", tempId, error: "Network error" });
      setReplyText(trimmed);
    }
  }, [replyText, isAuthenticated, postId, currentUserId]);

  // ─── Delete Reply ──────────────────────────────────────────────
  const handleDeleteReply = useCallback(
    async (replyId: string) => {
      if (!confirm("Delete this reply?")) return;
      try {
        const res = await fetch(`/api/posts/${postId}/replies/${replyId}`, {
          method: "DELETE",
        });
        if (res.ok || res.status === 204) {
          dispatch({ type: "DELETE_SUCCESS", replyId });
        }
      } catch {
        // silently fail
      }
    },
    [postId]
  );

  // ─── Share Document Form State ────────────────────────────────
  const [showShareForm, setShowShareForm] = useState(false);
  const [shareTitle, setShareTitle] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleShareDocument = useCallback(async () => {
    const trimmedTitle = shareTitle.trim();
    const trimmedUrl = shareUrl.trim();
    if (!trimmedTitle || !trimmedUrl || !isAuthenticated) return;

    // Basic URL validation
    try {
      new URL(trimmedUrl);
    } catch {
      setShareError("Please enter a valid URL");
      return;
    }

    setShareSubmitting(true);
    setShareError(null);

    try {
      const res = await fetch(`/api/posts/${postId}/shared-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          url: trimmedUrl,
          sourceType: "link",
        }),
      });

      if (res.status === 409) {
        setShareError("This URL has already been shared");
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to share" }));
        setShareError(err.error ?? "Failed to share document");
        return;
      }

      const doc: SharedDocument = await res.json();
      // Add to local state and reset pagination to avoid stale cursor
      setSharedDocs((s) => {
        const mergedItems = [...s.items, doc];
        if (onSharedUrlsChange) {
          onSharedUrlsChange(new Set(mergedItems.map((d) => d.url)));
        }
        return {
          ...s,
          items: mergedItems,
          totalCount: s.totalCount + 1,
          nextCursor: null,
          hasMore: false,
        };
      });
      // Reset form
      setShareTitle("");
      setShareUrl("");
      setShowShareForm(false);
      onDocumentShared?.();
    } catch {
      setShareError("Network error");
    } finally {
      setShareSubmitting(false);
    }
  }, [shareTitle, shareUrl, isAuthenticated, postId, onSharedUrlsChange, onDocumentShared]);

  // ─── Add shared document (called by parent after sharing) ─────
  // Exposed via ref or parent can re-fetch; for now parent handles via prop update
  // This is handled by the parent refetching shared docs after POST

  // ─── Source icon helper ────────────────────────────────────────
  const sourceIcon = (type: string) => {
    if (type === "sharepoint") return "📋";
    if (type === "email") return "📧";
    if (type === "link") return "🔗";
    return "📁";
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pt-2">
      {/* ═══ Replies Section ═══ */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 mb-2">
          💬 Replies {replies.totalCount > 0 && `(${replies.totalCount})`}
        </h3>

        {/* Reply Input Form */}
        {isExpired ? (
          <p className="text-xs text-gray-300 mb-2">Replies are disabled on expired posts</p>
        ) : !isAuthenticated ? (
          <p className="text-xs text-gray-300 mb-2">Sign in to reply ✨</p>
        ) : (
          <div className="mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
                placeholder="Write a reply..."
                maxLength={500}
                disabled={replies.submitting}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-40"
              />
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || replyText.length > 500 || replies.submitting}
                className="px-4 py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white text-sm font-semibold rounded-xl hover:from-blue-500 hover:to-purple-600 disabled:opacity-40 transition-all active:scale-95"
              >
                Send
              </button>
            </div>
            <div className="text-[10px] text-gray-300 mt-1 text-right">
              {replyText.length}/500
            </div>
          </div>
        )}

        {/* Error message */}
        {replies.error && (
          <p className="text-xs text-red-400 mb-2">{replies.error}</p>
        )}

        {/* Replies List */}
        {replies.loading && replies.items.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            Loading replies...
          </div>
        ) : replies.items.length === 0 ? (
          <p className="text-xs text-gray-300">No replies yet. Be the first to reply!</p>
        ) : (
          <div className="space-y-2">
            {replies.items.map((reply) => (
              <div
                key={reply.id}
                className={`bg-gray-50 rounded-xl p-3 ${
                  reply._optimistic ? "opacity-50 animate-pulse pointer-events-none" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-[10px] font-bold">
                      {(reply.authorName ?? "?")[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-gray-600">
                      {reply.authorName}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {new Date(reply.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {reply._optimistic && (
                      <span className="text-[10px] text-purple-400">Sending…</span>
                    )}
                  </div>
                  {/* Delete button — own replies only */}
                  {currentUserId && reply.authorId === currentUserId && !reply._optimistic && (
                    <button
                      onClick={() => handleDeleteReply(reply.id)}
                      className="text-gray-300 hover:text-red-400 text-xs transition-colors"
                      title="Delete reply"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Load More Replies */}
        {replies.hasMore && (
          <button
            onClick={loadMoreReplies}
            disabled={replies.loading}
            className="mt-2 w-full py-2 text-xs font-semibold text-purple-400 bg-purple-50 rounded-xl hover:bg-purple-100 disabled:opacity-40 transition-colors"
          >
            {replies.loading ? (
              <span className="flex items-center justify-center gap-1">
                <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              "Load more replies"
            )}
          </button>
        )}
      </div>

      {/* ═══ Shared Documents Section ═══ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-500">
            📎 Shared Documents {sharedDocs.totalCount > 0 && `(${sharedDocs.totalCount})`}
          </h3>
          {isAuthenticated && !isExpired && (
            <button
              onClick={() => setShowShareForm((v) => !v)}
              className="text-[10px] font-semibold text-purple-400 hover:text-purple-600 transition-colors"
            >
              {showShareForm ? "Cancel" : "+ Share a link"}
            </button>
          )}
        </div>

        {/* Share Document Form */}
        {showShareForm && (
          <div className="mb-3 p-3 bg-purple-50/60 rounded-xl space-y-2">
            <input
              type="text"
              value={shareTitle}
              onChange={(e) => setShareTitle(e.target.value)}
              placeholder="Document title"
              maxLength={500}
              disabled={shareSubmitting}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-40 bg-white"
            />
            <input
              type="url"
              value={shareUrl}
              onChange={(e) => setShareUrl(e.target.value)}
              placeholder="https://..."
              disabled={shareSubmitting}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-40 bg-white"
            />
            {shareError && (
              <p className="text-xs text-red-400">{shareError}</p>
            )}
            <button
              onClick={handleShareDocument}
              disabled={!shareTitle.trim() || !shareUrl.trim() || shareSubmitting}
              className="w-full py-2 bg-gradient-to-r from-blue-400 to-purple-500 text-white text-sm font-semibold rounded-xl hover:from-blue-500 hover:to-purple-600 disabled:opacity-40 transition-all active:scale-95"
            >
              {shareSubmitting ? "Sharing..." : "Share Document"}
            </button>
          </div>
        )}

        {sharedDocs.loading && sharedDocs.items.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            Loading documents...
          </div>
        ) : sharedDocs.items.length === 0 ? (
          <p className="text-xs text-gray-300">No shared documents</p>
        ) : (
          <ul className="space-y-2">
            {sharedDocs.items.map((doc) => (
              <li key={doc.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm">{sourceIcon(doc.sourceType)}</span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium line-clamp-1"
                    >
                      {doc.title}
                    </a>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white text-[8px] font-bold">
                        {(doc.sharerName ?? "?")[0].toUpperCase()}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        shared by {doc.sharerName} ·{" "}
                        {new Date(doc.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Load More Documents */}
        {sharedDocs.hasMore && (
          <button
            onClick={loadMoreDocs}
            disabled={sharedDocs.loading}
            className="mt-2 w-full py-2 text-xs font-semibold text-purple-400 bg-purple-50 rounded-xl hover:bg-purple-100 disabled:opacity-40 transition-colors"
          >
            {sharedDocs.loading ? (
              <span className="flex items-center justify-center gap-1">
                <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              "Load more documents"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Hook for parent to add a document to the shared docs list after a successful POST.
 * Re-export the types so parent can reference them.
 */
export type { SharedDocsState };
