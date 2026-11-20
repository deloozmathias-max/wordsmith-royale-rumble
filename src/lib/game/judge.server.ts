// Server-only: rates a synonym. Curated list first, then cached judgments, then Datamuse.
import { externalTier, quickJudge, type Judgment } from "./judge-core";

export type { Judgment };

export async function judgeAnswer(word: string, raw: string): Promise<Judgment> {
  const q = quickJudge(word, raw);
  if ("done" in q) return q.done;
  const { answer } = q;

  let db: typeof import("@/integrations/supabase/client.server").supabaseAdmin | null = null;
  try {
    db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: cached } = await db
      .from("judgments")
      .select("tier")
      .eq("word", word)
      .eq("answer", answer)
      .maybeSingle();
    if (cached) return { ok: true, answer, tier: cached.tier };
  } catch (e) {
    console.error("judgment cache unavailable", e);
  }

  const tier = await externalTier(word, answer);
  if (tier === null) return { ok: true, answer, tier: 0 };
  try {
    await db?.from("judgments").upsert({ word, answer, tier });
  } catch (e) {
    console.error("could not cache judgment", e);
  }
  return { ok: true, answer, tier };
}
