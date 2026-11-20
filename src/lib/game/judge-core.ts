// Synonym rating shared by the server and offline mode. No database access here.
import { dictionaryTier, isSameWord, normalizeAnswer } from "./words";
import { validateSynonym } from "./filter";

export type Judgment = { ok: true; answer: string; tier: number } | { ok: false; error: string };

type Datamuse = { word: string; score?: number; tags?: string[] }[];

async function fetchDatamuse(params: string): Promise<Datamuse | null> {
  try {
    const res = await fetch(`https://api.datamuse.com/words?${params}`);
    if (!res.ok) return null;
    return (await res.json()) as Datamuse;
  } catch (e) {
    console.warn("datamuse failed", e);
    return null;
  }
}

/** Tier from the Datamuse API, or null when the service can't be reached. */
export async function externalTier(word: string, answer: string): Promise<number | null> {
  const [syn, ml] = await Promise.all([
    fetchDatamuse(`rel_syn=${encodeURIComponent(word)}&max=80`),
    fetchDatamuse(`ml=${encodeURIComponent(word)}&max=80`),
  ]);
  if (!syn && !ml) return null;
  const target = answer.replace(/-/g, " ");
  const synIdx = syn?.findIndex((d) => d.word.toLowerCase() === target) ?? -1;
  if (synIdx >= 0) return synIdx < 8 ? 2 : 1;
  const mlIdx = ml?.findIndex((d) => d.word.toLowerCase() === target) ?? -1;
  if (mlIdx >= 0) {
    const tags = ml?.[mlIdx]?.tags ?? [];
    if (tags.includes("syn")) return mlIdx < 10 ? 2 : 1;
    return mlIdx < 25 ? 1 : 0;
  }
  return 0;
}

/** Filter, same-word and curated-list checks. Returns a final verdict or the cleaned answer to look up. */
export function quickJudge(word: string, raw: string): { done: Judgment } | { answer: string } {
  const v = validateSynonym(raw);
  if (!v.ok) return { done: { ok: false, error: v.error } };
  const answer = normalizeAnswer(v.value);
  if (isSameWord(word, answer)) return { done: { ok: true, answer, tier: 0 } };
  const dict = dictionaryTier(word, answer);
  if (dict !== null) return { done: { ok: true, answer, tier: dict } };
  return { answer };
}
