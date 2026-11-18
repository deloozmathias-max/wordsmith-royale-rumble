// Curated English word bank. Each word lists synonyms by quality:
// best = 30 pts, good = 20 pts, ok = 10 pts. Unknown answers are checked by the server.
export type WordEntry = { word: string; best: string[]; good: string[]; ok: string[] };

export const WORDS: WordEntry[] = [
  { word: "happy", best: ["joyful", "cheerful", "content", "delighted", "elated"], good: ["glad", "pleased", "merry", "jolly", "upbeat"], ok: ["cheery", "chipper", "sunny", "fine", "good"] },
  { word: "sad", best: ["sorrowful", "unhappy", "melancholy", "dejected", "downcast"], good: ["gloomy", "miserable", "blue", "down", "heartbroken"], ok: ["low", "glum", "upset", "moody", "tearful"] },
  { word: "big", best: ["large", "huge", "enormous", "massive", "immense"], good: ["giant", "gigantic", "vast", "great", "colossal"], ok: ["tall", "bulky", "hefty", "wide", "jumbo"] },
  { word: "small", best: ["little", "tiny", "minute", "compact", "miniature"], good: ["petite", "mini", "slight", "wee", "minor"], ok: ["short", "baby", "teeny", "narrow", "light"] },
  { word: "fast", best: ["quick", "rapid", "swift", "speedy", "brisk"], good: ["hasty", "fleet", "nimble", "express", "zippy"], ok: ["hurried", "snappy", "lively", "sudden", "agile"] },
  { word: "angry", best: ["furious", "irate", "enraged", "livid", "mad"], good: ["cross", "annoyed", "irritated", "fuming", "upset"], ok: ["grumpy", "heated", "sore", "bitter", "outraged"] },
  { word: "smart", best: ["intelligent", "clever", "bright", "brilliant", "wise"], good: ["sharp", "gifted", "brainy", "quick", "astute"], ok: ["able", "witty", "genius", "knowing", "shrewd"] },
  { word: "brave", best: ["courageous", "fearless", "bold", "valiant", "heroic"], good: ["daring", "gallant", "intrepid", "plucky", "gutsy"], ok: ["strong", "tough", "confident", "game", "hardy"] },
  { word: "cold", best: ["chilly", "freezing", "frigid", "icy", "frosty"], good: ["cool", "wintry", "nippy", "bitter", "arctic"], ok: ["crisp", "raw", "chill", "polar", "frozen"] },
  { word: "hot", best: ["warm", "scorching", "boiling", "sweltering", "blazing"], good: ["burning", "heated", "fiery", "baking", "sizzling"], ok: ["sultry", "humid", "toasty", "spicy", "roasting"] },
  { word: "beautiful", best: ["gorgeous", "lovely", "stunning", "attractive", "pretty"], good: ["handsome", "elegant", "exquisite", "radiant", "charming"], ok: ["cute", "fine", "nice", "fair", "graceful"] },
  { word: "tired", best: ["exhausted", "weary", "fatigued", "sleepy", "drained"], good: ["worn", "beat", "drowsy", "spent", "knackered"], ok: ["dead", "done", "lazy", "sluggish", "bushed"] },
  { word: "rich", best: ["wealthy", "affluent", "prosperous", "loaded", "opulent"], good: ["moneyed", "welloff", "comfortable", "flush", "privileged"], ok: ["lavish", "fancy", "plush", "luxurious", "elite"] },
  { word: "strange", best: ["odd", "weird", "peculiar", "bizarre", "unusual"], good: ["curious", "funny", "eerie", "uncanny", "abnormal"], ok: ["different", "rare", "quirky", "unfamiliar", "new"] },
  { word: "quiet", best: ["silent", "calm", "hushed", "still", "peaceful"], good: ["soft", "muted", "tranquil", "noiseless", "low"], ok: ["shy", "mute", "serene", "restful", "reserved"] },
  { word: "loud", best: ["noisy", "deafening", "booming", "thunderous", "blaring"], good: ["roaring", "rowdy", "rackety", "shrill", "strong"], ok: ["harsh", "vocal", "brash", "clamorous", "piercing"] },
  { word: "old", best: ["aged", "ancient", "elderly", "antique", "vintage"], good: ["senior", "mature", "former", "dated", "outdated"], ok: ["past", "worn", "gray", "used", "classic"] },
  { word: "difficult", best: ["hard", "tough", "challenging", "demanding", "complicated"], good: ["tricky", "complex", "arduous", "laborious", "strenuous"], ok: ["heavy", "uphill", "rough", "awkward", "serious"] },
  { word: "easy", best: ["simple", "effortless", "straightforward", "painless", "basic"], good: ["light", "smooth", "clear", "elementary", "breezy"], ok: ["soft", "plain", "cushy", "relaxed", "gentle"] },
  { word: "funny", best: ["hilarious", "humorous", "comical", "amusing", "witty"], good: ["entertaining", "silly", "hysterical", "jokey", "droll"], ok: ["goofy", "playful", "odd", "strange", "laughable"] },
  { word: "scared", best: ["afraid", "frightened", "terrified", "fearful", "petrified"], good: ["nervous", "anxious", "spooked", "alarmed", "panicky"], ok: ["worried", "jumpy", "shaky", "timid", "uneasy"] },
  { word: "important", best: ["significant", "crucial", "essential", "vital", "major"], good: ["key", "critical", "main", "serious", "big"], ok: ["central", "notable", "primary", "relevant", "urgent"] },
  { word: "begin", best: ["start", "commence", "launch", "initiate", "open"], good: ["kickoff", "undertake", "establish", "found", "embark"], ok: ["create", "lead", "trigger", "spark", "introduce"] },
  { word: "end", best: ["finish", "conclude", "stop", "terminate", "close"], good: ["complete", "cease", "halt", "wrap", "cut"], ok: ["quit", "expire", "result", "final", "death"] },
  { word: "help", best: ["assist", "aid", "support", "serve", "back"], good: ["boost", "rescue", "save", "relieve", "guide"], ok: ["further", "advise", "promote", "benefit", "ease"] },
  { word: "look", best: ["see", "watch", "observe", "gaze", "view"], good: ["glance", "stare", "peek", "peer", "eye"], ok: ["examine", "check", "inspect", "glimpse", "seek"] },
  { word: "talk", best: ["speak", "chat", "converse", "discuss", "communicate"], good: ["say", "tell", "gossip", "chatter", "babble"], ok: ["lecture", "address", "utter", "mention", "express"] },
  { word: "walk", best: ["stroll", "stride", "march", "wander", "hike"], good: ["amble", "saunter", "trek", "step", "tread"], ok: ["roam", "pace", "move", "go", "travel"] },
  { word: "eat", best: ["consume", "devour", "dine", "feast", "munch"], good: ["chew", "nibble", "swallow", "gobble", "snack"], ok: ["taste", "bite", "graze", "feed", "digest"] },
  { word: "think", best: ["ponder", "consider", "reflect", "contemplate", "reason"], good: ["believe", "suppose", "muse", "imagine", "wonder"], ok: ["guess", "plan", "deem", "feel", "expect"] },
  { word: "create", best: ["make", "build", "produce", "invent", "design"], good: ["craft", "form", "generate", "develop", "construct"], ok: ["establish", "found", "cause", "compose", "shape"] },
  { word: "destroy", best: ["ruin", "demolish", "wreck", "annihilate", "obliterate"], good: ["smash", "crush", "devastate", "break", "shatter"], ok: ["damage", "end", "kill", "erase", "level"] },
  { word: "friend", best: ["buddy", "pal", "companion", "mate", "ally"], good: ["chum", "comrade", "partner", "bestie", "confidant"], ok: ["acquaintance", "colleague", "associate", "neighbor", "bro"] },
  { word: "house", best: ["home", "residence", "dwelling", "abode", "building"], good: ["cottage", "villa", "mansion", "homestead", "place"], ok: ["shelter", "cabin", "flat", "apartment", "pad"] },
  { word: "job", best: ["work", "occupation", "profession", "career", "employment"], good: ["position", "role", "task", "post", "trade"], ok: ["gig", "duty", "chore", "business", "vocation"] },
  { word: "mistake", best: ["error", "blunder", "fault", "slip", "oversight"], good: ["flaw", "gaffe", "lapse", "misstep", "fumble"], ok: ["bug", "goof", "oops", "accident", "failure"] },
  { word: "idea", best: ["concept", "thought", "notion", "plan", "theory"], good: ["insight", "vision", "suggestion", "proposal", "belief"], ok: ["hunch", "image", "opinion", "scheme", "dream"] },
  { word: "calm", best: ["peaceful", "serene", "tranquil", "relaxed", "composed"], good: ["quiet", "still", "placid", "cool", "collected"], ok: ["mellow", "gentle", "steady", "easy", "smooth"] },
  { word: "strong", best: ["powerful", "mighty", "sturdy", "robust", "tough"], good: ["muscular", "solid", "hardy", "durable", "forceful"], ok: ["fit", "firm", "intense", "heavy", "able"] },
  { word: "weak", best: ["feeble", "frail", "fragile", "flimsy", "delicate"], good: ["faint", "puny", "powerless", "soft", "infirm"], ok: ["thin", "shaky", "poor", "limp", "lame"] },
  { word: "shiny", best: ["glossy", "gleaming", "sparkling", "glittering", "lustrous"], good: ["bright", "polished", "radiant", "shimmering", "dazzling"], ok: ["glowing", "sleek", "brilliant", "silky", "smooth"] },
  { word: "dirty", best: ["filthy", "grimy", "muddy", "soiled", "unclean"], good: ["dusty", "messy", "stained", "grubby", "mucky"], ok: ["foul", "nasty", "greasy", "polluted", "sloppy"] },
];

export function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[\u2019]/g, "'");
}

/** Tier from the curated list: 3 best, 2 good, 1 ok, null when unknown. */
export function dictionaryTier(word: string, answer: string): 0 | 1 | 2 | 3 | null {
  const entry = WORDS.find((w) => w.word === word);
  if (!entry) return null;
  const a = normalizeAnswer(answer);
  const compact = a.replace(/[\s-]/g, "");
  const has = (list: string[]) => list.some((x) => x === a || x === compact);
  if (has(entry.best)) return 3;
  if (has(entry.good)) return 2;
  if (has(entry.ok)) return 1;
  return null;
}

/** Answers that are the prompt word itself (or a simple form of it) score nothing. */
export function isSameWord(word: string, answer: string): boolean {
  const a = normalizeAnswer(answer).replace(/[\s-]/g, "");
  const w = word.toLowerCase();
  if (a === w) return true;
  const stem = w.length > 4 ? w.slice(0, w.length - 1) : w;
  return a.startsWith(stem) && a.length <= w.length + 4;
}
