import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/game/SiteHeader";
import { GameView } from "@/components/game/GameView";
import { COUNTDOWN_MS, ROUNDS, botAnswersByRound, makeBots, pickWords, scoreGame, type Answer, type Player } from "@/lib/game/engine";
import { judgeSafe, submitBotsGameSafe } from "@/lib/game/api";
import { saveLocalScore } from "@/lib/game/offline";
import { newSeed } from "@/lib/game/challenge";

function newGame(fixedSeed?: number) {
  const seed = fixedSeed ?? newSeed();
  return { seed, words: pickWords(seed), bots: makeBots(seed, 9), startsAt: Date.now() + COUNTDOWN_MS };
}

type Props = {
  playerId: string;
  playerKey: string;
  name: string;
  /** Fixed words (challenge link or Daily Royale); otherwise a random game. */
  seed?: number;
  challenge?: { challenger: string | null; targetScore: number | null } | null;
  daily?: { key: string; number: number } | null;
  /** Replaces "play again with new words" (used by fixed-seed games). */
  onPlayAgain?: () => void;
  onScore?: (score: number) => void;
};

/** A 10-player game against 9 seeded bots, scored by the server (or on this device when offline). */
export function BotsGame({ playerId, playerKey, name, seed, challenge = null, daily = null, onPlayAgain, onScore }: Props) {
  const [game, setGame] = useState(() => newGame(seed));
  const [mine, setMine] = useState<(Answer | null)[]>(() => Array(ROUNDS).fill(null));
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [scoreNote, setScoreNote] = useState<string | null>(null);
  const mineRef = useRef(mine);
  mineRef.current = mine;

  const now = useCallback(() => Date.now(), []);
  const players: Player[] = useMemo(() => [{ id: playerId, name, isBot: false }, ...game.bots], [playerId, name, game.bots]);
  const botAnswers = useMemo(() => botAnswersByRound(game.seed, game.bots, game.words), [game]);
  const answers = useMemo(() => botAnswers.map((r, i) => ({ ...r, [playerId]: mine[i] })), [botAnswers, mine, playerId]);

  const onSubmit = useCallback(
    async (round: number, text: string, ms: number) => {
      const res = await judgeSafe(game.words[round] ?? "", text);
      if (res.ok) setMine((m) => m.map((a, i) => (i === round ? { answer: res.answer, tier: res.tier, ms } : a)));
      return res;
    },
    [game.words],
  );

  const onFinished = useCallback(async () => {
    const m = mineRef.current;
    const res = !playerKey ? null : await submitBotsGameSafe({
      playerId,
      playerKey,
      name,
      seed: game.seed,
      answers: m.map((a) => a?.answer ?? null),
      ms: m.map((a) => a?.ms ?? null),
      ...(daily ? { dailyKey: daily.key } : {}),
    });
    if (res) {
      setFinalScore(res.score);
      if (res.counted === false) setScoreNote("Only your first Daily Royale of the day counts — this one wasn't added.");
      onScore?.(res.score);
      return;
    }
    // Offline: score the game here and keep it on this device.
    const local = scoreGame(players, botAnswers.map((r, i) => ({ ...r, [playerId]: m[i] }))).totals[playerId] ?? 0;
    setFinalScore(local);
    saveLocalScore({ playerId, name, score: local, mode: daily ? "daily" : "bots" });
    onScore?.(local);
    toast("Playing offline — your score is saved on this device.");
  }, [playerId, playerKey, name, game.seed, players, botAnswers, daily, onScore]);

  const playAgain = () => {
    if (onPlayAgain) return onPlayAgain();
    setGame(newGame());
    setMine(Array(ROUNDS).fill(null));
    setFinalScore(null);
  };

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      <GameView
        key={game.seed}
        modeLabel={daily ? `Daily Royale #${daily.number}` : challenge ? `Challenge from ${challenge.challenger ?? "a friend"}` : "vs Bots"}
        seed={game.seed}
        challenge={challenge}
        daily={daily}
        scoreNote={scoreNote}
        words={game.words}
        players={players}
        youId={playerId}
        startsAt={game.startsAt}
        now={now}
        answers={answers}
        onSubmit={onSubmit}
        onFinished={onFinished}
        finalScore={finalScore}
        onPlayAgain={playAgain}
      />
    </div>
  );
}
