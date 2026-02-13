// Category definitions per data-model.md — emoji, label, colors for each PostCategory
import type { PostCategory } from "@/app/types";

export interface CategoryDefinition {
  id: PostCategory;
  emoji: string;
  label: string;
  color: string;        // Primary color (speech-bubble background)
  colorLight: string;   // Light variant (ring / highlight)
  tailColor: string;    // Speech-bubble tail color (matches background)
}

export const CATEGORIES: Record<PostCategory, CategoryDefinition> = {
  question: {
    id: "question",
    emoji: "❓",
    label: "Question",
    color: "#60a5fa",
    colorLight: "rgba(96,165,250,0.3)",
    tailColor: "#60a5fa",
  },
  discussion: {
    id: "discussion",
    emoji: "💬",
    label: "Discussion",
    color: "#a78bfa",
    colorLight: "rgba(167,139,250,0.3)",
    tailColor: "#a78bfa",
  },
  share: {
    id: "share",
    emoji: "💡",
    label: "Share",
    color: "#fbbf24",
    colorLight: "rgba(251,191,36,0.3)",
    tailColor: "#fbbf24",
  },
  help: {
    id: "help",
    emoji: "🆘",
    label: "Help",
    color: "#f87171",
    colorLight: "rgba(248,113,113,0.3)",
    tailColor: "#f87171",
  },
  meetup: {
    id: "meetup",
    emoji: "☕",
    label: "Meetup",
    color: "#34d399",
    colorLight: "rgba(52,211,153,0.3)",
    tailColor: "#34d399",
  },
};

export const DEFAULT_CATEGORY: PostCategory = "discussion";

export const CATEGORY_VALUES: PostCategory[] = [
  "question", "discussion", "share", "help", "meetup",
];
