// Friend challenges: a link carries the game seed (same 5 words, same 9 bots), the score to
// beat and the challenger's name. Everything is derived from the seed, so no server is needed.
import { MAX_GAME_SCORE, type RoundScore } from "./engine";
import { validatePlayerName } from "./filter";

export const MAX_SEED = 2_147_483_647;

/** URL search params for /challenge and /play/bots. All optional; invalid values are dropped. */
export type ChallengeSearch = { seed?: number; targetScore?: number; challenger?: string };

function toInt(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) ? v : null;
  if (typeof v === "string" && /^\d{1,10}$/.test(v)) return Number(v);
  return null;
}

export function parseChallengeSearch(s: Record<string, unknown>): ChallengeSearch {
  const seed = toInt(s["seed"]);
  if (seed === null || seed < 0 || seed > MAX_SEED) return {};
  const out: ChallengeSearch = { seed };
  const target = toInt(s["targetScore"]);
  if (target !== null && target >= 0 && target <= MAX_GAME_SCORE) out.targetScore = target;
  const name = s["challenger"];
  if (typeof name === "string") {
    const r = validatePlayerName(name);
    if (r.ok) out.challenger = r.value;
  }
  return out;
}

export function newSeed(rand: () => number = Math.random): number {
  return Math.floor(rand() * 2_000_000_000);
}

export const TIER_EMOJI: Record<number, string> = { 3: "🟩", 2: "🟨", 1: "🟧", 0: "⬛" };

/** One square per round (🟩 Perfect · 🟨 Good · 🟧 Fair · ⬛ miss), ✨ after a unique answer. */
export function resultGrid(rounds: (RoundScore | undefined)[]): string {
  return rounds.map((r) => `${TIER_EMOJI[r?.answer ? r.tier : 0] ?? "⬛"}${r?.unique ? "✨" : ""}`).join(" ");
}

export type Verdict = "beat" | "tied" | "lost";
export function verdict(score: number, target: number): Verdict {
  return score > target ? "beat" : score === target ? "tied" : "lost";
}

const RANK_EMOJI = ["👑", "🥈", "🥉"];

export function buildResultText(o: {
  score: number;
  rank: number;
  playerCount: number;
  rounds: (RoundScore | undefined)[];
  link: string;
  challenge?: { challenger: string | null; targetScore: number | null } | null;
  /** Daily Royale number, when this was the daily game. */
  daily?: number;
}): string {
  const title = o.daily ? `Synonym Royale Daily #${o.daily}` : "Synonym Royale";
  const lines = [
    `${title} ${RANK_EMOJI[o.rank - 1] ?? "🎯"} #${o.rank} of ${o.playerCount} · ${o.score} pts`,
    resultGrid(o.rounds),
  ];
  const t = o.challenge?.targetScore;
  if (t !== null && t !== undefined) {
    const who = o.challenge?.challenger ? `${o.challenge.challenger}'s` : "my friend's";
    const v = verdict(o.score, t);
    lines.push(v === "beat" ? `Beat ${who} ${t} ✅` : v === "tied" ? `Tied ${who} ${t} 🤝` : `Fell short of ${who} ${t} ❌`);
  }
  lines.push(o.daily ? `Same 5 words for everyone today: ${o.link}` : `Can you beat me? ${o.link}`);
  return lines.join("\n");
}
