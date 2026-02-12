// T031: generate_action_hint tool — uses app's ai-foundry for GPT-4o-mini, with template fallback
import { getOrchestrationClient, getChatDeploymentName } from "@/app/lib/ai-foundry";

/**
 * Generate a 1-line action hint.
 * Primary: GPT-4o-mini via app's AI Foundry client.
 * Fallback: template-based hint when AI Foundry is unavailable.
 */
export async function generateActionHint(
  postText: string,
  searchResults: Array<{ title: string; description: string; sourceType: string }>
): Promise<string | null> {
  if (!searchResults || searchResults.length === 0) return null;

  // Primary: Try GPT-4o-mini via AI Foundry
  const client = getOrchestrationClient();
  if (client) {
    try {
      const model = getChatDeploymentName();
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "Based on the search results provided, suggest ONE concrete next action in one sentence. Be specific — suggest a particular document to read, issue to check, or action to take. Write in the same language as the post text. Keep it concise and actionable.",
          },
          {
            role: "user",
            content: `Post: "${postText}"\n\nSearch results:\n${JSON.stringify(searchResults.slice(0, 3))}`,
          },
        ],
        max_tokens: 60,
        temperature: 0.3,
      });
      const hint = response.choices[0]?.message?.content?.trim();
      if (hint) return hint;
    } catch (err) {
      console.log("[action_hint] AI Foundry failed:", (err as Error).message);
    }
  }

  // Fallback: Template-based hint generation
  console.log("[action_hint] Using template fallback");
  const topResult = searchResults[0];
  const sourceLabel =
    topResult.sourceType === "m365"
      ? "M365"
      : topResult.sourceType === "doc"
        ? "Docs"
        : topResult.sourceType === "issue"
          ? "Issue"
          : "Post";

  const templates = [
    `High chance of resolution based on ${sourceLabel} — check "${topResult.title}" first.`,
    `Refer to the "${topResult.title}" document to proceed.`,
    `You may find hints in related ${sourceLabel} — ${topResult.title}`,
  ];

  const idx = ["m365", "doc"].includes(topResult.sourceType) ? 0
    : ["issue"].includes(topResult.sourceType) ? 1
    : 2;
  return templates[idx] ?? templates[0];
}
