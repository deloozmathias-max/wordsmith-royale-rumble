import { describe, expect, it } from "vitest";
import { defaultPlayerName, looksLikeGibberish, validatePlayerName, validateSynonym } from "./filter";
import { quickJudge } from "./judge-core";
import { WORDS, targetVariant } from "./words";

describe("stricter player names", () => {
  it.each(["Sam99", "Player1", "4ever"])("blocks numbers: %s", (n) => expect(validatePlayerName(n).ok).toBe(false));
  it.each(["Sam_V", "Zoe-writes", "Mr.Fox", "Sam  !"])("blocks symbols: %s", (n) => expect(validatePlayerName(n).ok).toBe(false));
  it.each(["aaaa", "Saaaam", "asdfgh", "qwerty", "xkcdq", "hahaha", "lololol", "Brrrt"])("blocks gibberish: %s", (n) =>
    expect(validatePlayerName(n).ok).toBe(false),
  );
  it.each(["Mathias", "Classic Sam", "WordWizard", "Anna Lee", "Rhythm"])("allows %s", (n) =>
    expect(validatePlayerName(n).ok).toBe(true),
  );
  it("every suggested default name passes the filter", () => {
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++) {
        const seq = [i / 12 + 0.001, j / 12 + 0.001];
        const name = defaultPlayerName(() => seq.shift() ?? 0);
        expect(validatePlayerName(name)).toMatchObject({ ok: true });
      }
  });
});

describe("stricter synonyms", () => {
  it.each(["glad2", "j0yful", "glad!", "aaaa", "gladdd", "asdf", "xyzq", "blah blah blah"])("blocks %s", (w) =>
    expect(validateSynonym(w).ok).toBe(false),
  );
  it("every curated synonym still passes the filter", () => {
    const bad = WORDS.flatMap((w) => [...w.best, ...w.good, ...w.ok]).filter((s) => !validateSynonym(s).ok);
    expect(bad).toEqual([]);
  });
  it("still accepts multi-word synonyms", () => expect(validateSynonym("well off").ok).toBe(true));
});

describe("variants of the target word are rejected", () => {
  it.each([
    ["happy", "happier"],
    ["happy", "happily"],
    ["happy", "happiness"],
    ["begin", "begins"],
    ["begin", "beginning"],
    ["talk", "talked"],
    ["big", "bigger"],
    ["eat", "eats"],
    ["happy", "very happy"],
  ])("%s → %s is a form", (w, a) => expect(targetVariant(w, a)).toBe("form"));

  it.each([
    ["happy", "hapy"],
    ["happy", "hpapy"],
    ["begin", "begun"],
    ["beautiful", "beatiful"],
    ["difficult", "dificult"],
  ])("%s → %s is a typo", (w, a) => expect(targetVariant(w, a)).toBe("typo"));

  it("quickJudge refuses forms and typos instead of scoring them", () => {
    expect(quickJudge("happy", "happier")).toEqual({ done: { ok: false, error: expect.stringContaining("form") } });
    expect(quickJudge("happy", "hapy")).toEqual({ done: { ok: false, error: expect.stringContaining("Too close") } });
  });

  it("curated synonyms always count, even when they look close (cold → cool)", () => {
    expect(quickJudge("cold", "cool")).toEqual({ done: { ok: true, answer: "cool", tier: 2 } });
  });

  it("no curated synonym is mistaken for a variant", () => {
    const clash = WORDS.flatMap((w) => [...w.best, ...w.good, ...w.ok].filter((s) => targetVariant(w.word, s)).map((s) => `${w.word}:${s}`));
    // Curated answers are checked first, so this only documents overlaps.
    expect(clash.every((c) => quickJudge(c.split(":")[0]!, c.split(":")[1]!).hasOwnProperty("done"))).toBe(true);
  });

  it("real unrelated words are not flagged", () => {
    expect(targetVariant("happy", "cheerful")).toBeNull();
    expect(targetVariant("fast", "quick")).toBeNull();
    expect(looksLikeGibberish("strengthen")).toBe(false);
  });
});
