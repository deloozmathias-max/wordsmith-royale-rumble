// Offline mode: rate synonyms and keep scores on this device when the game server can't be reached.
import { readJson, writeJson } from "@/lib/safe-storage";
import { externalTier, quickJudge, type Judgment } from "./judge-core";
import type { LeaderboardRow } from "./game.functions";
import type { LeaderboardPeriod } from "./daily";

const JUDGE_KEY = "sr.offlineJudgments";
const SCORES_KEY = "sr.localScores";
const DAY = 86_400_000;

export async function judgeOffline(word: string, raw: string): Promise<Judgment> {
  const q = quickJudge(word, raw);
  if ("done" in q) return q.done;
  const cache = readJson<Record<string, number>>(JUDGE_KEY, {});
  const k = `${word}|${q.answer}`;
  const hit = cache[k];
  if (typeof hit === "number") return { ok: true, answer: q.answer, tier: hit };
  const tier = await externalTier(word, q.answer);
  if (tier === null) return { ok: true, answer: q.answer, tier: 0 };
  writeJson(JUDGE_KEY, Object.keys(cache).length > 500 ? { [k]: tier } : { ...cache, [k]: tier });
  return { ok: true, answer: q.answer, tier };
}

export type LocalScore = { playerId: string; name: string; score: number; mode: "bots" | "online" | "daily"; at: number };

export function readLocalScores(): LocalScore[] {
  const list = readJson<unknown>(SCORES_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter(
    (s): s is LocalScore =>
      !!s && typeof s.playerId === "string" && typeof s.name === "string" && typeof s.score === "number" && typeof s.at === "number",
  );
}

export function saveLocalScore(s: Omit<LocalScore, "at">, at = Date.now()): void {
  writeJson(SCORES_KEY, [...readLocalScores(), { ...s, at }].slice(-500));
}

/** Same windows as the online leaderboard: today and this week (from Monday), in UTC. */
export function periodStart(period: LeaderboardPeriod, now: number): number {
  if (period === "all") return -Infinity;
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (period === "daily" || period === "royale") return midnight;
  return midnight - ((d.getUTCDay() + 6) % 7) * DAY;
}

export function buildLeaderboard(scores: LocalScore[], period: LeaderboardPeriod, now = Date.now()): LeaderboardRow[] {
  const from = periodStart(period, now);
  const rows = new Map<string, LeaderboardRow>();
  for (const s of scores) {
    if (s.at < from || (period === "royale" && s.mode !== "daily")) continue;
    const row = rows.get(s.playerId) ?? { player_id: s.playerId, name: s.name, total: 0, games: 0, best: 0 };
    row.name = s.name;
    row.total += s.score;
    row.games += 1;
    row.best = Math.max(row.best, s.score);
    rows.set(s.playerId, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || b.best - a.best);
}
