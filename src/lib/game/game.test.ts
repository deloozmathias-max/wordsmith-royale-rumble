import { describe, expect, it } from "vitest";
import { validatePlayerName, validateSynonym, sanitizePlayerName } from "./filter";
import { ROUNDS, ROUND_MS, UNIQUE_BONUS, makeBots, phaseAt, pickWords, scoreRound, botAnswer } from "./engine";
import { dictionaryTier } from "./words";

describe("game rules", () => {
  it("has 5 rounds of 20 seconds", () => {
    expect(ROUNDS).toBe(5);
    expect(ROUND_MS).toBe(20_000);
    expect(pickWords(42)).toHaveLength(5);
  });

  it("fills a vs-bots game with 9 bots", () => {
    expect(makeBots(123, 9)).toHaveLength(9);
  });

  it("gives a +10 uniqueness bonus only when nobody else picked the same synonym", () => {
    const s = scoreRound({
      a: { answer: "joyful", tier: 3, ms: 1000 },
      b: { answer: "glad", tier: 2, ms: 1000 },
      c: { answer: "Glad", tier: 2, ms: 1000 },
    });
    expect(UNIQUE_BONUS).toBe(10);
    expect(s["a"]?.total).toBe(40);
    expect(s["b"]?.total).toBe(20);
    expect(s["c"]?.unique).toBe(false);
  });

  it("gives no points or bonus to an invalid answer", () => {
    const s = scoreRound({ a: { answer: "banana", tier: 0, ms: 1 } });
    expect(s["a"]?.total).toBe(0);
  });

  it("scores better synonyms higher", () => {
    expect(dictionaryTier("happy", "joyful")).toBe(3);
    expect(dictionaryTier("happy", "glad")).toBe(2);
    expect(dictionaryTier("happy", "fine")).toBe(1);
  });

  it("bots answer with a realistic delay", () => {
    for (let i = 0; i < 50; i++) {
      const a = botAnswer(i, "bot-1", 0, "happy");
      if (a) expect(a.ms).toBeGreaterThanOrEqual(4000);
    }
  });

  it("moves from round to results phase after 20s", () => {
    expect(phaseAt(0, 19_999).kind).toBe("round");
    expect(phaseAt(0, 20_001).kind).toBe("results");
  });
});

describe("name & synonym filter", () => {
  it.each(["f*ck", "****", "sh1t", "FUUUCK", "kutding", "Klootzak99", "b i t c h", "a$$", "asshole_x", "tering"])(
    "blocks name %s",
    (name) => expect(validatePlayerName(name).ok).toBe(false),
  );

  it.each(["Classic Sam", "Grape", "Hoera", "WordWizard"])("allows name %s", (name) => {
    expect(validatePlayerName(name).ok).toBe(true);
  });

  it("replaces a blocked name with a clean default", () => {
    const n = sanitizePlayerName("sh*t");
    expect(validatePlayerName(n).ok).toBe(true);
  });

  it("applies the same filter to synonyms", () => {
    expect(validateSynonym("pissed").ok).toBe(false);
    expect(validateSynonym("**").ok).toBe(false);
    expect(validateSynonym("joyful").ok).toBe(true);
  });
});
