import { sfx } from "@/lib/sfx";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ClipboardCopy, Crown, Loader2, RotateCcw, Sparkles, Swords, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/game/ShareDialog";
import { useChallengeLink, useDailyLink } from "@/hooks/use-challenge-link";
import { copyText } from "@/lib/clipboard";
import { buildResultText, verdict } from "@/lib/game/challenge";
import {
  ROUNDS,
  ROUND_MS,
  TIER_LABEL,
  phaseAt,
  rankPlayers,
  scoreGame,
  scoreRound,
  type Answer,
  type Player,
  type RoundScore,
} from "@/lib/game/engine";
import { validateSynonym } from "@/lib/game/filter";

export type SubmitResult = { ok: true; answer: string; tier: number } | { ok: false; error: string };

type Props = {
  words: string[];
  players: Player[];
  youId: string;
  startsAt: number;
  now: () => number;
  answers: Record<string, Answer | null | undefined>[];
  onSubmit: (round: number, text: string, ms: number) => Promise<SubmitResult>;
  onFinished: () => void;
  finalScore: number | null;
  onPlayAgain: () => void;
  modeLabel: string;
  /** Seed of this game: friends replay it through a challenge link. */
  seed: number;
  /** Set when playing someone's challenge link. */
  challenge?: Challenge | null;
  /** Set for the Daily Royale (same words for everyone today). */
  daily?: { key: string; number: number } | null;
  /** Shown under the final score (e.g. a Daily Royale replay that didn't count). */
  scoreNote?: string | null;
};

type Challenge = { challenger: string | null; targetScore: number | null };

const TIER_CHIP: Record<number, string> = {
  3: "border-tier-3/40 bg-tier-3/10 text-tier-3",
  2: "border-tier-2/40 bg-tier-2/10 text-tier-2",
  1: "border-tier-1/40 bg-tier-1/10 text-tier-1",
  0: "border-border bg-muted text-tier-0",
};

function useTicker(now: () => number) {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), 100);
    return () => clearInterval(id);
  }, [now]);
  return t;
}

export function GameView(props: Props) {
  const { words, players, youId, startsAt, answers, now } = props;
  const t = useTicker(now);
  const phase = phaseAt(startsAt, t);

  const completedRounds =
    phase.kind === "finished" ? ROUNDS : phase.kind === "results" ? phase.round + 1 : phase.kind === "round" ? phase.round : 0;

  const { totals, rounds } = useMemo(
    () => scoreGame(players, answers.slice(0, completedRounds)),
    [players, answers, completedRounds],
  );

  const finishedRef = useRef(false);
  useEffect(() => {
    if (phase.kind === "finished" && !finishedRef.current) {
      finishedRef.current = true;
      sfx.fanfare();
      props.onFinished();
    }
  }, [phase.kind, props]);

  const you = players.find((p) => p.id === youId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6">
      {phase.kind !== "finished" && (
        <TopBar
          label={props.modeLabel}
          round={phase.kind === "countdown" ? -1 : phase.round}
          score={totals[youId] ?? 0}
          name={you?.name ?? "You"}
          target={props.challenge?.targetScore ?? null}
        />
      )}

      {phase.kind === "countdown" && <Countdown msLeft={phase.msLeft} players={players} youId={youId} />}

      {phase.kind === "round" && (
        <RoundStage
          key={phase.round}
          round={phase.round}
          word={words[phase.round] ?? ""}
          msLeft={phase.msLeft}
          elapsed={phase.elapsed}
          players={players}
          youId={youId}
          answers={answers[phase.round] ?? {}}
          totals={totals}
          onSubmit={props.onSubmit}
        />
      )}

      {phase.kind === "results" && (
        <RoundResults
          round={phase.round}
          word={words[phase.round] ?? ""}
          msLeft={phase.msLeft}
          players={players}
          youId={youId}
          answers={answers[phase.round] ?? {}}
        />
      )}

      {phase.kind === "finished" && (
        <FinalStandings
          players={players}
          youId={youId}
          totals={totals}
          finalScore={props.finalScore}
          onPlayAgain={props.onPlayAgain}
          seed={props.seed}
          words={words}
          rounds={rounds.map((r) => r[youId])}
          challenge={props.challenge ?? null}
          daily={props.daily ?? null}
          scoreNote={props.scoreNote ?? null}
        />
      )}
    </div>
  );
}

function TopBar({
  label,
  round,
  score,
  name,
  target,
}: {
  label: string;
  round: number;
  score: number;
  name: string;
  target: number | null;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <p className="kicker">{label}</p>
        <div className="mt-1.5 flex gap-1.5" aria-label={`Round ${round + 1} of ${ROUNDS}`}>
          {Array.from({ length: ROUNDS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-7 rounded-full transition-colors ${
                i < round ? "bg-primary/60" : i === round ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="text-right">
        <p className="kicker truncate">{name}</p>
        <p className="tabular text-2xl font-bold text-primary">
          {score}
          {target !== null && <span className="ml-1.5 text-sm font-semibold text-muted-foreground">/ {target} to beat</span>}
        </p>
      </div>
    </div>
  );
}

function Countdown({ msLeft, players, youId }: { msLeft: number; players: Player[]; youId: string }) {
  const s = Math.ceil(msLeft / 1000);
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <p className="kicker">Get ready</p>
      <p key={s} className="tabular animate-pop mt-4 text-[7rem] font-bold leading-none text-primary sm:text-[9rem]">
        {s}
      </p>
      <p className="mt-4 max-w-sm text-muted-foreground">
        5 rounds · 20 seconds each. Better synonyms score more — and nobody else picking yours earns{" "}
        <span className="font-semibold text-accent">+10</span>.
      </p>
      <div className="mt-10 w-full">
        <PlayerGrid players={players} youId={youId} />
      </div>
    </div>
  );
}

function PlayerGrid({
  players,
  youId,
  status,
  totals,
}: {
  players: Player[];
  youId: string;
  status?: (p: Player) => "thinking" | "typing" | "locked";
  totals?: Record<string, number>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {players.map((p) => {
        const st = status?.(p);
        const isYou = p.id === youId;
        return (
          <li
            key={p.id}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
              isYou ? "border-primary/50 bg-primary/5" : "border-border bg-surface"
            }`}
          >
            <span className="min-w-0 truncate font-medium">
              {p.name}
              {isYou && <span className="ml-1 text-primary">(you)</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {totals && <span className="tabular text-xs text-muted-foreground">{totals[p.id] ?? 0}</span>}
              {st === "locked" && <Check className="size-3.5 text-primary" aria-label="answered" />}
              {st === "typing" && <span className="tabular animate-blink text-xs text-muted-foreground">•••</span>}
              {st === "thinking" && <span className="size-1.5 rounded-full bg-muted-foreground/40" />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RoundStage(props: {
  round: number;
  word: string;
  msLeft: number;
  elapsed: number;
  players: Player[];
  youId: string;
  answers: Record<string, Answer | null | undefined>;
  totals: Record<string, number>;
  onSubmit: Props["onSubmit"];
}) {
  const { round, word, msLeft, elapsed, players, youId, answers } = props;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mine = answers[youId];
  const lockedAnswer = locked ?? mine?.answer ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const secs = Math.ceil(msLeft / 1000);
  const pct = Math.max(0, Math.min(100, (msLeft / ROUND_MS) * 100));
  const urgent = msLeft < 5000;
  const tickRef = useRef(0);
  useEffect(() => {
    if (urgent && !lockedAnswer && secs > 0 && tickRef.current !== secs) {
      tickRef.current = secs;
      sfx.tick(secs <= 2);
    }
  }, [urgent, secs, lockedAnswer]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || lockedAnswer) return;
    const v = validateSynonym(text);
    if (!v.ok) {
      setError(v.error);
      sfx.error();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await props.onSubmit(round, v.value, elapsed);
      if (res.ok) {
        setLocked(res.answer);
        sfx.lock();
      } else {
        setError(res.error);
        sfx.error();
      }
    } catch {
      sfx.error();
      setError("Couldn't send your answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const status = (p: Player): "thinking" | "typing" | "locked" => {
    if (p.id === youId) return lockedAnswer ? "locked" : "thinking";
    const a = answers[p.id];
    if (!a) return "thinking";
    if (!p.isBot) return "locked";
    if (a.ms <= elapsed) return "locked";
    if (a.ms - elapsed < 3000) return "typing";
    return "thinking";
  };
  const lockedCount = players.filter((p) => status(p) === "locked").length;

  return (
    <div className="animate-rise">
      <section className="panel relative overflow-hidden px-5 py-8 text-center sm:px-10 sm:py-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-secondary">
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${urgent ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="kicker">
            Round {round + 1} / {ROUNDS}
          </p>
          <p className={`tabular text-xl font-bold ${urgent ? "text-destructive" : "text-foreground"}`}>
            {secs}s
          </p>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">Type the best synonym for</p>
        <h2 className="animate-pop mt-2 break-words font-display text-6xl font-extrabold uppercase leading-none sm:text-8xl">
          {word}
        </h2>

        {lockedAnswer ? (
          <div className="animate-pop mx-auto mt-10 flex max-w-md items-center justify-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-5 py-4">
            <Check className="size-5 text-primary" />
            <span className="text-muted-foreground">Locked in:</span>
            <span className="font-display text-xl font-bold">{lockedAnswer}</span>
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-10 flex max-w-md flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              placeholder="your synonym…"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={24}
              aria-label="Your synonym"
              aria-invalid={!!error}
              className="h-14 w-full shrink-0 rounded-xl border border-input sm:w-auto sm:flex-1 bg-background px-4 text-center font-display text-xl font-semibold outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary sm:text-left"
            />
            <Button type="submit" variant="hero" size="xl" disabled={busy || !text.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : "Lock in"}
            </Button>
          </form>
        )}
        <p className="mt-3 min-h-5 text-sm text-destructive" role="alert">
          {error}
        </p>
      </section>

      <div className="mt-6 flex items-center justify-between">
        <p className="kicker">Players</p>
        <p className="kicker">
          {lockedCount}/{players.length} locked in
        </p>
      </div>
      <div className="mt-3">
        <PlayerGrid players={players} youId={youId} status={status} totals={props.totals} />
      </div>
    </div>
  );
}

function RoundResults(props: {
  round: number;
  word: string;
  msLeft: number;
  players: Player[];
  youId: string;
  answers: Record<string, Answer | null | undefined>;
}) {
  const { round, word, players, youId, answers } = props;
  const scores = useMemo(() => {
    const filled: Record<string, Answer | null> = {};
    for (const p of players) filled[p.id] = answers[p.id] ?? null;
    return scoreRound(filled);
  }, [players, answers]);
  const sorted = [...players].sort(
    (a, b) =>
      (scores[b.id]?.total ?? 0) - (scores[a.id]?.total ?? 0) || (scores[a.id]?.ms ?? 1e9) - (scores[b.id]?.ms ?? 1e9),
  );
  const last = round === ROUNDS - 1;

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">Round {round + 1} results</p>
          <h2 className="mt-1 font-display text-4xl font-extrabold uppercase sm:text-5xl">{word}</h2>
        </div>
        <p className="tabular text-sm text-muted-foreground">
          {last ? "Final standings" : "Next round"} in {Math.ceil(props.msLeft / 1000)}s
        </p>
      </div>
      <ol className="panel divide-y divide-border overflow-hidden">
        {sorted.map((p, i) => {
          const s = scores[p.id] ?? { answer: null, tier: 0, base: 0, unique: false, total: 0, ms: null };
          const isYou = p.id === youId;
          return (
            <li
              key={p.id}
              className={`animate-rise flex items-center gap-3 px-4 py-3 ${isYou ? "bg-primary/5" : ""}`}
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span className="tabular w-5 text-xs text-muted-foreground">{i + 1}</span>
              <span className="w-28 min-w-0 truncate text-sm font-medium sm:w-40">
                {p.name}
                {isYou && <span className="ml-1 text-primary">(you)</span>}
              </span>
              <span className={`min-w-0 flex-1 truncate font-display text-lg font-bold ${s.answer ? "" : "text-muted-foreground/60"}`}>
                {s.answer || "—"}
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                {s.answer && (
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TIER_CHIP[s.tier]}`}>
                    {TIER_LABEL[s.tier]}
                  </span>
                )}
                {s.unique && (
                  <span className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                    <Sparkles className="size-3" /> Unique +10
                  </span>
                )}
              </span>
              <span className="tabular w-12 text-right text-lg font-bold text-primary">+{s.total}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs text-muted-foreground sm:hidden">
        Perfect 30 · Good 20 · Fair 10 · Unique +10
      </p>
    </div>
  );
}

function FinalStandings(props: {
  players: Player[];
  youId: string;
  totals: Record<string, number>;
  finalScore: number | null;
  onPlayAgain: () => void;
  seed: number;
  words: string[];
  rounds: (RoundScore | undefined)[];
  challenge: Challenge | null;
  daily: { key: string; number: number } | null;
  scoreNote: string | null;
}) {
  const { players, youId, totals, daily } = props;
  const challengeLink = useChallengeLink();
  const dailyLink = useDailyLink();
  const [shareOpen, setShareOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const ranked = rankPlayers(players, totals);
  const yourRank = ranked.findIndex((p) => p.id === youId) + 1;
  const podium = ranked.slice(0, 3);
  const medal = ["text-gold", "text-silver", "text-bronze"];
  const heights = ["h-36", "h-28", "h-24"];
  const order = [1, 0, 2];
  const you = players.find((p) => p.id === youId);
  const score = props.finalScore ?? totals[youId] ?? 0;
  const target = props.challenge?.targetScore ?? null;
  const link = challengeLink({
    seed: props.seed,
    targetScore: score,
    ...(you?.name ? { challenger: you.name } : {}),
  });
  const resultText = buildResultText({
    score,
    rank: yourRank,
    playerCount: players.length,
    rounds: props.rounds,
    link: daily ? dailyLink() : link,
    challenge: props.challenge,
    ...(daily ? { daily: daily.number } : {}),
  });

  async function copyResult() {
    if (await copyText(resultText)) toast.success("Result copied — paste it anywhere!");
    else setResultOpen(true);
  }

  return (
    <div className="animate-rise pt-4 text-center">
      <p className="kicker">Game over</p>
      <h2 className="mt-2 font-display text-5xl font-extrabold sm:text-6xl">
        {yourRank === 1 ? (
          <>
            Royale <span className="text-primary">champion</span>
          </>
        ) : (
          <>
            You placed <span className="text-primary">#{yourRank}</span>
          </>
        )}
      </h2>
      <p className="mt-3 text-muted-foreground">
        {props.finalScore === null ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Saving your score…
          </span>
        ) : (
          <>
            <span className="tabular font-bold text-foreground">{props.finalScore}</span>{" "}
            {props.scoreNote ? "points" : "points added to the leaderboard"}
            {props.scoreNote && <span className="mt-1 block text-sm">{props.scoreNote}</span>}
          </>
        )}
      </p>

      <RoundCards words={props.words} rounds={props.rounds} />

      {target !== null && props.finalScore !== null && (
        <ChallengeVerdict score={props.finalScore} target={target} challenger={props.challenge?.challenger ?? null} />
      )}

      <div className="mx-auto mt-10 grid max-w-md grid-cols-3 items-end gap-3">
        {order.map((idx) => {
          const p = podium[idx];
          if (!p) return <div key={idx} />;
          return (
            <div key={p.id} className="flex flex-col items-center gap-2">
              {idx === 0 && <Crown className="size-6 text-gold" />}
              <span className={`max-w-full truncate text-sm font-semibold ${p.id === youId ? "text-primary" : ""}`}>
                {p.name}
              </span>
              <div
                className={`flex w-full flex-col items-center justify-start rounded-t-xl border border-b-0 border-border bg-surface pt-3 ${heights[idx]}`}
              >
                <span className={`font-display text-3xl font-extrabold ${medal[idx]}`}>{idx + 1}</span>
                <span className="tabular text-sm text-muted-foreground">{totals[p.id]}</span>
              </div>
            </div>
          );
        })}
      </div>

      <ol className="panel mx-auto max-w-md divide-y divide-border overflow-hidden text-left">
        {ranked.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-3 px-4 py-2.5 ${p.id === youId ? "bg-primary/5" : ""}`}>
            <span className="tabular w-6 text-sm text-muted-foreground">{i + 1}</span>
            <span className="flex-1 truncate font-medium">
              {p.name}
              {p.id === youId && <span className="ml-1 text-primary">(you)</span>}
            </span>
            <span className="tabular font-bold">{totals[p.id]}</span>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-8 grid max-w-md gap-3 sm:grid-cols-2">
        {!daily && (
          <Button variant="hero" size="xl" onClick={() => setShareOpen(true)} disabled={props.finalScore === null}>
            <Swords /> Challenge a Friend
          </Button>
        )}
        <Button variant="arena" size="xl" onClick={copyResult} disabled={props.finalScore === null}>
          <ClipboardCopy /> Copy Result
        </Button>
        <Button variant="arena" size="xl" onClick={props.onPlayAgain}>
          <RotateCcw /> {daily ? "Play vs Bots" : "Play again"}
        </Button>
        <Button variant={daily ? "hero" : "arena"} size="xl" asChild>
          <Link to="/leaderboard" search={{ period: daily ? "royale" : "daily" }}>
            <Trophy /> Leaderboard
          </Link>
        </Button>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Challenge a Friend"
        description={`Your friend gets the same 5 words and the same bots, with ${score} points to beat.`}
        text={link}
      />
      <ShareDialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        title="Your result"
        description="Copy this summary and paste it in any chat."
        text={resultText}
      />
    </div>
  );
}

function ChallengeVerdict({ score, target, challenger }: { score: number; target: number; challenger: string | null }) {
  const v = verdict(score, target);
  const who = challenger ?? "your friend";
  return (
    <div
      className={`animate-pop mx-auto mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-semibold ${
        v === "lost" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/40 bg-primary/10 text-primary"
      }`}
    >
      <Target className="size-4" />
      {v === "beat" ? `You beat ${who}'s ${target}!` : v === "tied" ? `Tied with ${who} at ${target}` : `${target - score} short of ${who}'s ${target}`}
    </div>
  );
}

const CARD_TONE: Record<number, string> = {
  3: "border-tier-3/50 bg-tier-3/10",
  2: "border-tier-2/50 bg-tier-2/10",
  1: "border-tier-1/50 bg-tier-1/10",
  0: "border-border bg-muted/40",
};

const TIER_TEXT: Record<number, string> = { 3: "text-tier-3", 2: "text-tier-2", 1: "text-tier-1", 0: "text-tier-0" };

/** One recap card per round: word, your answer, points and the unique bonus. */
function RoundCards({ words, rounds }: { words: string[]; rounds: (RoundScore | undefined)[] }) {
  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <p className="kicker">Your rounds</p>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Array.from({ length: ROUNDS }).map((_, i) => {
          const r = rounds[i];
          const tier = r?.answer ? r.tier : 0;
          return (
            <li
              key={i}
              className={`animate-rise flex flex-col items-center gap-1 rounded-xl border px-2 py-3 ${CARD_TONE[tier]} ${i === ROUNDS - 1 ? "col-span-2 sm:col-span-1" : ""}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Round {i + 1}</span>
              <span className="w-full truncate font-display text-sm font-extrabold uppercase">{words[i] ?? "—"}</span>
              <span className={`w-full truncate text-sm ${r?.answer ? "font-semibold" : "text-muted-foreground/60"}`}>
                {r?.answer || "no answer"}
              </span>
              <span className={`tabular text-lg font-bold ${r?.answer ? TIER_TEXT[tier] : "text-muted-foreground"}`}>
                +{r?.total ?? 0}
              </span>
              {r?.unique && (
                <span className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  <Sparkles className="size-3" /> UNIQUE +10
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
