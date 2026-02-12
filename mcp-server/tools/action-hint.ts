// T031: generate_action_hint tool — template-based or gpt-4o-mini 1-line hint
// For MVP, uses template-based approach. AI Foundry chat is called from the app side.

export function generateActionHint(
  postText: string,
  searchResults: Array<{ title: string; description: string; sourceType: string }>
): string | null {
  if (!searchResults || searchResults.length === 0) return null;

  // Template-based hint generation (MVP fallback)
  const topResult = searchResults[0];
  const sourceLabel =
    topResult.sourceType === "doc"
      ? "Docs"
      : topResult.sourceType === "issue"
        ? "Issue"
        : "Post";

  // Generate a concrete next-action hint
  const templates = [
    `${sourceLabel} 기반 해결 가능성이 높습니다 — "${topResult.title}"을(를) 먼저 확인하세요.`,
    `"${topResult.title}" 문서를 참고하여 진행해 보세요.`,
    `관련 ${sourceLabel}에서 힌트를 얻을 수 있습니다 — ${topResult.title}`,
  ];

  // Pick template based on source type
  const idx = topResult.sourceType === "doc" ? 0 : topResult.sourceType === "issue" ? 1 : 2;
  return templates[idx] ?? templates[0];
}
