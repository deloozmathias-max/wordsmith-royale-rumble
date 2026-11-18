import { WORDS, normalizeAnswer } from "./words";
import { hashSeed, mulberry32, shuffle } from "./rng";

export const PLAYERS_PER_GAME = 10;
export const ROUNDS = 5;
export const ROUND_MS = 20_000;
export const RESULTS_MS = 7_000;
export const COUNTDOWN_MS = 5_000;
export const UNIQUE_BONUS = 10;
export const TIER_POINTS: Record<number, number> = { 0: 0, 1: 10, 2: 20, 3: 30 };
export const TIER_LABEL: Record<number, string> = { 0: "Miss", 1: "Fair", 2: "Good", 3: "Perfect" };
export const MAX_GAME_SCORE = ROUNDS * (30 + UNIQUE_BONUS);

export type Phase =
  | { kind: "countdown"; msLeft: number }
  | { kind: "round"; round: number; msLeft: number; elapsed: number }
  | { kind: "results"; round: number; msLeft: number }
  | { kind: "finished" };

/** startsAt = the moment round 1 begins. */
export function phaseAt(startsAt: number, now: number): Phase {
  if (now < startsAt) return { kind: "countdown", msLeft: startsAt - now };
  const t = now - startsAt;
  const slot = ROUND_MS + RESULTS_MS;
  const round = Math.floor(t / slot);
  if (round >= ROUNDS) return { kind: "finished" };
  const inSlot = t - round * slot;
  if (inSlot < ROUND_MS) return { kind: "round", round, msLeft: ROUND_MS - inSlot, elapsed: inSlot };
  return { kind: "results", round, msLeft: slot - inSlot };
}

export function gameEndsAt(startsAt: number) {
  return startsAt + ROUNDS * (ROUND_MS + RESULTS_MS);
}

export function pickWords(seed: number): string[] {
  const rand = mulberry32(hashSeed("words", seed));
  return shuffle(WORDS.map((w) => w.word), rand).slice(0, ROUNDS);
}

const BOT_NAMES = [
  "Mira", "WordWizard", "Jonas", "LexiLuna", "Theo_K", "Ava", "Quillsy", "Noor", "Finn88",
  "Sophie", "Ravi", "PunMaster", "Elena", "Kai", "Bram", "Zoe_writes", "Liam", "Thesaurus_T",
  "Yara", "Milo", "Ines", "Daan", "Priya", "Oscar", "Lotte", "Sam_V", "Nadia", "Hugo",
];

export type Player = { id: string; name: string; isBot: boolean };

export function makeBots(seed: number, count: number): Player[] {
  const rand = mulberry32(hashSeed("bots", seed));
  return shuffle(BOT_NAMES, rand)
    .slice(0, count)
    .map((name, i) => ({ id: `bot-${i}`, name, isBot: true }));
}

export type Answer = { answer: string; tier: number; ms: number };

/** Bots use everyday synonyms with a human-like typing delay — and sometimes miss. */
export function botAnswer(seed: number, botId: string, round: number, word: string): Answer | null {
  const rand = mulberry32(hashSeed("bot-answer", seed, botId, round));
  const entry = WORDS.find((w) => w.word === word);
  if (!entry) return null;
  if (rand() < 0.12) return null; // ran out of time
  const r = rand();
  let tier: 1 | 2 | 3;
  let list: string[];
  if (r < 0.14) [tier, list] = [3, entry.best];
  else if (r < 0.66) [tier, list] = [2, entry.good];
  else [tier, list] = [1, entry.ok];
  // Bots lean towards the most common (first) options so they clash with each other.
  const idx = Math.min(list.length - 1, Math.floor(Math.pow(rand(), 3) * list.length));
  const ms = Math.round(4_000 + rand() * 12_500);
  const answer = list[idx];
  if (!answer) return null;
  return { answer, tier, ms };
}

export type RoundScore = { answer: string | null; tier: number; base: number; unique: boolean; total: number; ms: number | null };

/** Scores one round. Unique bonus: valid answer nobody else in the round typed. */
export function scoreRound(answers: Record<string, Answer | null | undefined>): Record<string, RoundScore> {
  const counts = new Map<string, number>();
  for (const a of Object.values(answers)) {
    if (a && a.tier > 0) {
      const k = normalizeAnswer(a.answer).replace(/[\s-]/g, "");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const out: Record<string, RoundScore> = {};
  for (const [pid, a] of Object.entries(answers)) {
    if (!a) {
      out[pid] = { answer: null, tier: 0, base: 0, unique: false, total: 0, ms: null };
      continue;
    }
    const base = TIER_POINTS[a.tier] ?? 0;
    const k = normalizeAnswer(a.answer).replace(/[\s-]/g, "");
    const unique = a.tier > 0 && counts.get(k) === 1;
    out[pid] = { answer: a.answer, tier: a.tier, base, unique, total: base + (unique ? UNIQUE_BONUS : 0), ms: a.ms };
  }
  return out;
}

/** Full-game totals. answersByRound[round][playerId]. */
export function scoreGame(players: Player[], answersByRound: Record<string, Answer | null | undefined>[]) {
  const totals: Record<string, number> = Object.fromEntries(players.map((p) => [p.id, 0]));
  const rounds = answersByRound.map((round) => {
    const filled: Record<string, Answer | null | undefined> = {};
    for (const p of players) filled[p.id] = round[p.id] ?? null;
    const s = scoreRound(filled);
    for (const p of players) totals[p.id] = (totals[p.id] ?? 0) + (s[p.id]?.total ?? 0);
    return s;
  });
  return { totals, rounds };
}

/** Fills bot answers for all rounds. */
export function botAnswersByRound(seed: number, bots: Player[], words: string[]) {
  return words.map((word, round) => {
    const r: Record<string, Answer | null> = {};
    for (const b of bots) r[b.id] = botAnswer(seed, b.id, round, word);
    return r;
  });
}

export function rankPlayers(players: Player[], totals: Record<string, number>) {
  return [...players].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0) || a.name.localeCompare(b.name));
}
