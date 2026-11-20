// Name + synonym filter. Blocks swear words (English + Dutch), insults, masking
// characters like *, leetspeak tricks, numbers, symbols and gibberish.

// Matched anywhere inside the text (also with spaces/dots removed).
const STRONG = [
  "fuck", "fuk", "fck", "shit", "bitch", "cunt", "pussy", "asshole", "arsehole", "bastard",
  "whore", "faggot", "nigger", "nigga", "retard", "wank", "twat", "motherf", "dildo", "porn",
  "penis", "vagina", "boob", "jerkoff", "blowjob", "handjob", "slut", "douche",
  "bollock", "skank", "kanker", "tyfus", "klootzak", "kloot", "mongool", "flikker",
  "neuk", "godver", "godsamme", "sukkel", "debiel", "hoerenjong", "kutwijf",
  "nazi", "hitler",
];

// Only matched as a whole word (avoids blocking "class", "cocktail", "grape", "hoera" ...).
const WHOLE = [
  "ass", "arse", "dick", "dik", "cock", "fag", "piss", "pissed", "prick", "crap", "damn", "sex", "sexy",
  "rape", "hoer", "pik", "slet", "trut", "teef", "kkk", "idiot", "moron", "dumb", "stupid", "loser",
  "hell", "butt", "lesbo", "tranny", "spast", "spasticus", "mongol", "cum", "tits", "rapist",
];

// Matched at the start of a word (Dutch compounds like "kutding", "teringzooi").
const PREFIX = ["kut", "lul", "tering", "kanker", "pik"];

// Words that contain a STRONG fragment but are innocent.
const ALLOW = ["lullaby", "lull", "lulled", "lulls", "kutter", "shiitake", "pikachu", "pike", "piket", "piker", "pikant"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b", "9": "g", "|": "i", "+": "t" };

const MASK_CHARS = /[*#%^&~`=<>\\/{}[\]()?!@$+|]/;

function deLeet(s: string): string {
  return s.toLowerCase().split("").map((c) => LEET[c] ?? c).join("");
}

function squashRepeats(s: string): string {
  return s.replace(/(.)\1{2,}/g, "$1$1");
}

export function containsProfanity(raw: string): boolean {
  const lowered = deLeet(raw);
  const tokens = lowered.split(/[^a-z]+/).filter(Boolean);
  const cleanTokens = tokens.filter((t) => !ALLOW.includes(t));
  const joined = cleanTokens.join("");
  const variants = [joined, squashRepeats(joined), joined.replace(/(.)\1+/g, "$1")];
  for (const v of variants) {
    if (STRONG.some((w) => v.includes(w))) return true;
  }
  for (const t of tokens) {
    const forms = [t, squashRepeats(t), t.replace(/(.)\1+/g, "$1")];
    if (forms.some((f) => WHOLE.includes(f))) return true;
    if (!ALLOW.includes(t) && PREFIX.some((p) => t.startsWith(p))) return true;
  }
  // Spaced out letters like "f u c k"
  const singles = lowered.replace(/[^a-z]/g, "");
  if (tokens.length >= 3 && tokens.every((t) => t.length <= 2)) {
    if (STRONG.some((w) => singles.includes(w)) || WHOLE.includes(singles)) return true;
  }
  return false;
}

// Keyboard mashing ("asdf", "qwerty") — none of these appear inside real English words.
const KEYBOARD = [
  "qwer", "wert", "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "zxcv", "xcvb", "cvbn", "vbnm",
  "yuio", "uiop", "poiu", "lkjh", "mnbv",
];

/** Letter strings that aren't plausible words: "aaaa", "hahaha", "xkcd", "asdfgh", "brrrt". */
export function looksLikeGibberish(raw: string): boolean {
  const tokens = raw.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const t of tokens) {
    if (/(.)\1{2,}/.test(t)) return true; // 3+ of the same letter in a row
    if (/(.{2,3})\1{2,}/.test(t)) return true; // same chunk 3+ times: ababab, lololol
    if (t.length >= 3 && !/[aeiouy]/.test(t)) return true; // no vowels at all
    if (/[^aeiouy]{5,}/.test(t)) return true; // 5+ consonants in a row
    if (KEYBOARD.some((k) => t.includes(k))) return true;
  }
  return false;
}

export type FilterResult = { ok: true; value: string } | { ok: false; error: string };

export function validatePlayerName(input: string): FilterResult {
  const value = input.trim().replace(/\s+/g, " ");
  if (value.length < 3) return { ok: false, error: "Name must be at least 3 characters." };
  if (value.length > 16) return { ok: false, error: "Name can be at most 16 characters." };
  if (/\d/.test(value)) return { ok: false, error: "Numbers aren't allowed in names." };
  if (MASK_CHARS.test(value)) return { ok: false, error: "Symbols like * or # aren't allowed in names." };
  if (!/^[A-Za-z]+( [A-Za-z]+)*$/.test(value)) return { ok: false, error: "Use letters only (one space between words is fine)." };
  if (value.replace(/ /g, "").length < 3) return { ok: false, error: "Name needs at least 3 letters." };
  if (containsProfanity(value)) return { ok: false, error: "That name isn't allowed. Please pick a clean name." };
  if (looksLikeGibberish(value)) return { ok: false, error: "That looks like gibberish — pick a real name." };
  return { ok: true, value };
}

export function validateSynonym(input: string): FilterResult {
  const value = input.trim().replace(/\s+/g, " ");
  if (value.length === 0) return { ok: false, error: "Type a synonym first." };
  if (value.length > 24) return { ok: false, error: "Keep it under 24 characters." };
  if (/\d/.test(value)) return { ok: false, error: "No numbers — just a word." };
  if (MASK_CHARS.test(value)) return { ok: false, error: "No symbols like * please — just letters." };
  if (!/^[A-Za-z]+([ '-][A-Za-z]+)*$/.test(value)) return { ok: false, error: "Letters only (a single space, - or ' between words is fine)." };
  if (containsProfanity(value)) return { ok: false, error: "Keep it clean — that word is blocked." };
  if (looksLikeGibberish(value)) return { ok: false, error: "That doesn't look like a real word." };
  return { ok: true, value: value.toLowerCase() };
}

const ADJ = ["Swift", "Clever", "Brave", "Lucky", "Witty", "Sunny", "Bold", "Quiet", "Rapid", "Noble", "Keen", "Jolly"];
const NOUN = ["Otter", "Falcon", "Fox", "Lexicon", "Panda", "Comet", "Owl", "Tiger", "Quill", "Atlas", "Raven", "Koala"];

export function defaultPlayerName(rand: () => number = Math.random): string {
  const a = ADJ[Math.floor(rand() * ADJ.length)];
  const n = NOUN[Math.floor(rand() * NOUN.length)];
  return `${a}${n}`;
}

/** Returns a clean name: the input when valid, otherwise a safe default. */
export function sanitizePlayerName(input: string): string {
  const r = validatePlayerName(input);
  return r.ok ? r.value : defaultPlayerName();
}
