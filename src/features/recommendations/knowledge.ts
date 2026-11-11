export type KnowledgeEntry = {
  id: string; topic: string; answer: string; terms: string[]; sourceTitle: string; sourceUrl: string;
  reviewedAt: string; expiresAt: string | null; relatedListingIds: string[];
};

function normalize(value: string) {
  return value.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
function phraseMatches(question: string, phrase: string) {
  const normalizedQuestion = ` ${normalize(question)} `;
  const normalizedPhrase = normalize(phrase);
  return normalizedPhrase.length >= 3 && normalizedQuestion.includes(` ${normalizedPhrase} `);
}

export function answerReviewedQuestion(question: string, entries: KnowledgeEntry[], contextListingId?: string, today = new Date().toISOString().slice(0, 10)) {
  const active = entries.filter((entry) => !entry.expiresAt || entry.expiresAt >= today);
  const ranked = active.map((entry, index) => ({ entry, index, matches: entry.terms.filter((term) => phraseMatches(question, term)).length + (phraseMatches(question, entry.topic) ? 2 : 0) }))
    .filter((item) => item.matches > 0)
    .sort((a, b) => b.matches - a.matches || Number(b.entry.relatedListingIds.includes(contextListingId ?? "")) - Number(a.entry.relatedListingIds.includes(contextListingId ?? "")) || a.index - b.index);
  const top = ranked[0];
  const tied = top ? ranked.filter((item) => item.matches === top.matches && item.entry.relatedListingIds.includes(contextListingId ?? "") === top.entry.relatedListingIds.includes(contextListingId ?? "")) : [];
  const relatedTopics = active.filter((entry) => entry.id !== (tied.length === 1 ? top?.entry.id : undefined)).slice(0, 3).map((entry) => entry.topic);
  if (!top || tied.length > 1) return { status: "fallback" as const, relatedTopics };
  return { status: "answered" as const, entry: top.entry, relatedTopics };
}
