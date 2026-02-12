// T013: 3-sentence validation utility per R6 research
// Counts sentence-ending punctuation (. ? ! and Korean equivalents)
// Excludes: URLs, ellipsis (...), abbreviations (e.g., i.e.)

const URL_PATTERN = /https?:\/\/\S+/g;
const ELLIPSIS_PATTERN = /\.{2,}/g;
const ABBREVIATION_PATTERN = /\b(e\.g\.|i\.e\.|etc\.|vs\.|Mr\.|Mrs\.|Dr\.|Prof\.)/gi;

/**
 * Count sentences in text, excluding URLs, ellipses, and abbreviations.
 * Sentence-ending: . ? ! (and full-width Korean equivalents)
 */
export function countSentences(text: string): number {
  if (!text.trim()) return 0;

  // Replace URLs with placeholder (no sentence-ending dots)
  let cleaned = text.replace(URL_PATTERN, "URL_PLACEHOLDER");

  // Replace ellipsis with placeholder
  cleaned = cleaned.replace(ELLIPSIS_PATTERN, "ELLIPSIS");

  // Replace abbreviations with placeholder
  cleaned = cleaned.replace(ABBREVIATION_PATTERN, "ABBREV");

  // Count sentence-ending punctuation: . ? ! and full-width equivalents
  const matches = cleaned.match(/[.?!。？！]/g);

  // If no sentence-ending punctuation found but there's text, count as 1 sentence
  if (!matches || matches.length === 0) {
    return text.trim().length > 0 ? 1 : 0;
  }

  return matches.length;
}

/**
 * Validate that text is within 3-sentence limit.
 * Returns { valid, sentenceCount, error? }
 */
export function validateSentences(text: string): {
  valid: boolean;
  sentenceCount: number;
  error?: string;
} {
  const sentenceCount = countSentences(text);
  if (sentenceCount > 3) {
    return {
      valid: false,
      sentenceCount,
      error: `Please keep within 3 sentences. Currently ${sentenceCount} sentence(s).`,
    };
  }
  return { valid: true, sentenceCount };
}

/**
 * Validate text length (max 500 chars)
 */
export function validateTextLength(text: string): boolean {
  return text.length <= 500;
}

/**
 * Validate coordinates
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Calculate expiresAt from TTL string
 */
export function calculateExpiresAt(
  ttl: "1m" | "24h" | "72h" | "7d",
  from?: Date
): string {
  const base = from ?? new Date();
  const ms: Record<string, number> = {
    "1m": 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "72h": 72 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };
  const expiresAt = new Date(base.getTime() + ms[ttl]);
  return expiresAt.toISOString();
}
