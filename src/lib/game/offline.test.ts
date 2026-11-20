import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/game/game.functions", () => {
  const down = async () => {
    throw new Error("network down");
  };
  return { registerPlayer: down, judgeSynonym: down, submitBotsGame: down, getLeaderboard: down };
});

import { judgeSafe, leaderboardSafe, registerPlayerSafe, submitBotsGameSafe } from "./api";
import { buildLeaderboard, periodStart, readLocalScores, saveLocalScore, type LocalScore } from "./offline";
import { safeStorage } from "@/lib/safe-storage";

// Friday 20 Nov 2026, 13:00 UTC
const NOW = Date.UTC(2026, 10, 20, 13, 0, 0);
const score = (name: string, points: number, at: number): LocalScore => ({ playerId: name, name, score: points, mode: "bots", at });

describe("offline fallback when the game server is unreachable", () => {
  beforeEach(() => localStorage.clear());

  it("registering a player resolves to null instead of throwing", async () => {
    await expect(registerPlayerSafe()).resolves.toBeNull();
  });

  it("still rates curated synonyms (joyful for happy = best tier 3)", async () => {
    const r = await judgeSafe("happy", "joyful");
    expect(r).toMatchObject({ ok: true, answer: "joyful" });
    expect(r.ok && r.tier).toBe(3);
  });

  it("still blocks profanity offline", async () => {
    const r = await judgeSafe("happy", "f*ck");
    expect(r.ok).toBe(false);
  });

  it("saving a bots game resolves to null so the page scores it locally", async () => {
    await expect(
      submitBotsGameSafe({ playerId: "p", name: "Sam", seed: 1, answers: [null, null, null, null, null], ms: [0, 0, 0, 0, 0] }),
    ).resolves.toBeNull();
  });

  it("leaderboard reports offline instead of failing", async () => {
    await expect(leaderboardSafe("daily")).resolves.toEqual({ rows: [], error: null, offline: true });
  });
});

describe("local leaderboard", () => {
  beforeEach(() => localStorage.clear());

  it("daily starts at UTC midnight and weekly on Monday UTC", () => {
    expect(periodStart("daily", NOW)).toBe(Date.UTC(2026, 10, 20));
    expect(periodStart("weekly", NOW)).toBe(Date.UTC(2026, 10, 16));
  });

  it("daily excludes yesterday's games, all-time includes them", () => {
    const scores = [score("Ann", 50, NOW - 3_600_000), score("Ann", 40, NOW - 86_400_000)];
    expect(buildLeaderboard(scores, "daily", NOW)).toEqual([{ player_id: "Ann", name: "Ann", total: 50, games: 1, best: 50 }]);
    expect(buildLeaderboard(scores, "all", NOW)[0]).toMatchObject({ total: 90, games: 2, best: 50 });
  });

  it("ranks by total points", () => {
    const rows = buildLeaderboard([score("Ann", 30, NOW), score("Bob", 80, NOW)], "all", NOW);
    expect(rows.map((r) => r.name)).toEqual(["Bob", "Ann"]);
  });

  it("saved scores are read back from this device", () => {
    saveLocalScore({ playerId: "p1", name: "Sam", score: 70, mode: "bots" }, NOW);
    expect(readLocalScores()).toEqual([{ playerId: "p1", name: "Sam", score: 70, mode: "bots", at: NOW }]);
  });

  it("storage that throws (blocked iframe) does not crash and keeps values in memory", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => safeStorage.set("x", "1")).not.toThrow();
    expect(safeStorage.get("x")).toBe("1");
    spy.mockRestore();
  });
});
