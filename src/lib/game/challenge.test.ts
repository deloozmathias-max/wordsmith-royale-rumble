import { describe, expect, it } from "vitest";
import { buildResultText, parseChallengeSearch, resultGrid, verdict } from "./challenge";
import { botAnswersByRound, makeBots, pickWords, type RoundScore } from "./engine";

const r = (tier: number, unique = false): RoundScore => ({ answer: tier ? "x" : null, tier, base: 0, unique, total: 0, ms: 1 });

describe("challenge links", () => {
  it("reads seed, score to beat and challenger", () => {
    expect(parseChallengeSearch({ seed: 12345, targetScore: 8, challenger: "Mathias" })).toEqual({
      seed: 12345,
      targetScore: 8,
      challenger: "Mathias",
    });
    expect(parseChallengeSearch({ seed: "12345", targetScore: "120" })).toEqual({ seed: 12345, targetScore: 120 });
  });
  it("drops everything without a valid seed", () => {
    expect(parseChallengeSearch({ seed: "abc", targetScore: 8 })).toEqual({});
    expect(parseChallengeSearch({ seed: -1 })).toEqual({});
  });
  it("drops impossible scores and rude or invalid challenger names", () => {
    expect(parseChallengeSearch({ seed: 1, targetScore: 9999, challenger: "fuckface" })).toEqual({ seed: 1 });
    expect(parseChallengeSearch({ seed: 1, challenger: "Sam99" })).toEqual({ seed: 1 });
  });
  it("the same seed gives friends the same words and the same bot answers", () => {
    const a = botAnswersByRound(777, makeBots(777, 9), pickWords(777));
    const b = botAnswersByRound(777, makeBots(777, 9), pickWords(777));
    expect(pickWords(777)).toEqual(pickWords(777));
    expect(a).toEqual(b);
  });
});

describe("copy result", () => {
  it("one square per round, sparkle for unique answers", () => {
    expect(resultGrid([r(3, true), r(2), r(1), r(0), r(3)])).toBe("🟩✨ 🟨 🟧 ⬛ 🟩");
  });
  it("verdict against the score to beat", () => {
    expect(verdict(130, 120)).toBe("beat");
    expect(verdict(120, 120)).toBe("tied");
    expect(verdict(100, 120)).toBe("lost");
  });
  it("summary includes rank, score, grid, verdict and link", () => {
    const text = buildResultText({
      score: 130,
      rank: 1,
      playerCount: 10,
      rounds: [r(3, true), r(2), r(1), r(0), r(3)],
      link: "https://x.test/#/challenge?seed=1",
      challenge: { challenger: "Mathias", targetScore: 120 },
    });
    expect(text.split("\n")).toEqual([
      "Synonym Royale 👑 #1 of 10 · 130 pts",
      "🟩✨ 🟨 🟧 ⬛ 🟩",
      "Beat Mathias's 120 ✅",
      "Can you beat me? https://x.test/#/challenge?seed=1",
    ]);
  });
});
