import { describe, expect, it } from "vitest";
import { dailyKey, dailyNumber, dailySeed, isAcceptedDailyKey, msUntilNextDaily } from "./daily";
import { pickWords } from "./engine";
import { buildLeaderboard } from "./offline";

const NOV23 = Date.UTC(2026, 10, 23, 18, 0);
const DAY = 86_400_000;

describe("Daily Royale", () => {
  it("gives everyone the same words on the same UTC day", () => {
    const a = dailySeed(dailyKey(Date.UTC(2026, 10, 23, 0, 1)));
    const b = dailySeed(dailyKey(Date.UTC(2026, 10, 23, 23, 59)));
    expect(a).toBe(b);
    expect(pickWords(a)).toEqual(pickWords(b));
  });

  it("changes words the next day", () => {
    expect(dailySeed("2026-11-23")).not.toBe(dailySeed("2026-11-24"));
  });

  it("numbers days from #1 on 23 Nov 2026", () => {
    expect(dailyNumber("2026-11-23")).toBe(1);
    expect(dailyNumber("2026-11-24")).toBe(2);
  });

  it("accepts today and yesterday only", () => {
    expect(isAcceptedDailyKey("2026-11-23", NOV23)).toBe(true);
    expect(isAcceptedDailyKey("2026-11-22", NOV23)).toBe(true);
    expect(isAcceptedDailyKey("2026-11-21", NOV23)).toBe(false);
    expect(isAcceptedDailyKey("2026-11-24", NOV23)).toBe(false);
  });

  it("counts down to the next UTC midnight", () => {
    expect(msUntilNextDaily(NOV23)).toBe(6 * 3_600_000);
  });

  it("offline royale board only counts today's daily games", () => {
    const rows = buildLeaderboard(
      [
        { playerId: "a", name: "A", score: 100, mode: "daily", at: NOV23 },
        { playerId: "a", name: "A", score: 90, mode: "bots", at: NOV23 },
        { playerId: "b", name: "B", score: 80, mode: "daily", at: NOV23 - DAY },
      ],
      "royale",
      NOV23,
    );
    expect(rows.map((r) => [r.player_id, r.total])).toEqual([["a", 100]]);
  });
});
