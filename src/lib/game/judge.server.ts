// Server-only: rates a synonym. Curated list first, then cached judgments, then Datamuse.
import { dictionaryTier, isSameWord, normalizeAnswer } from "./words";
import { validateSynonym } from "./filter";

type Datamuse = { word: string; score?: number; tags?: string[] }[];

async function fetchDatamuse(params: string): Promise<Datamuse | null> {
  try {
    const res = await fetch(`https://api.datamuse.com/words?${params}`);
    if (!res.ok) return null;
    return (await res.json()) as Datamuse;
  } catch (e) {
    console.error("datamuse failed", e);
    return null;
  }
}

async function externalTier(word: string, answer: string): Promise<number | null> {
  const [syn, ml] = await Promise.all([
    fetchDatamuse(`rel_syn=${encodeURIComponent(word)}&max=80`),
    fetchDatamuse(`ml=${encodeURIComponent(word)}&max=80`),
  ]);
  if (!syn && !ml) return null; // service unavailable: don't cache
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

export type Judgment = { ok: true; answer: string; tier: number } | { ok: false; error: string };

export async function judgeAnswer(word: string, raw: string): Promise<Judgment> {
  const v = validateSynonym(raw);
  if (!v.ok) return { ok: false, error: v.error };
  const answer = normalizeAnswer(v.value);
  if (isSameWord(word, answer)) return { ok: true, answer, tier: 0 };
  const dict = dictionaryTier(word, answer);
  if (dict !== null) return { ok: true, answer, tier: dict };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cached } = await supabaseAdmin
    .from("judgments")
    .select("tier")
    .eq("word", word)
    .eq("answer", answer)
    .maybeSingle();
  if (cached) return { ok: true, answer, tier: cached.tier };

  const tier = await externalTier(word, answer);
  if (tier === null) return { ok: true, answer, tier: 0 };
  await supabaseAdmin.from("judgments").upsert({ word, answer, tier });
  return { ok: true, answer, tier };
}
