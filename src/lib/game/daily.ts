// Daily Royale: one set of 5 words (and 9 bots) per UTC day, the same for every player.
// Everything derives from the date, so the server and every client agree without storing it.
import { hashSeed } from "./rng";

const DAY = 86_400_000;
/** Daily Royale #1 (UTC date). */
const LAUNCH = Date.UTC(2026, 10, 23);

/** UTC date of `now` as YYYY-MM-DD. */
export function dailyKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function dailyNumber(key: string): number {
  return Math.round((Date.parse(`${key}T00:00:00Z`) - LAUNCH) / DAY) + 1;
}

export function dailySeed(key: string): number {
  return hashSeed("daily", key) % 2_000_000_000;
}

/** A game started just before midnight may finish after it, so yesterday's key is still accepted. */
export function isAcceptedDailyKey(key: string, now: number = Date.now()): boolean {
  return key === dailyKey(now) || key === dailyKey(now - DAY);
}

export function msUntilNextDaily(now: number = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + DAY - now;
}

/** Leaderboard windows: "royale" = today's Daily Royale only. */
export type LeaderboardPeriod = "all" | "weekly" | "daily" | "royale";
export const LEADERBOARD_PERIODS: LeaderboardPeriod[] = ["all", "weekly", "daily", "royale"];
