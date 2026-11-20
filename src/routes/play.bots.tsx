import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/game/SiteHeader";
import { GameView } from "@/components/game/GameView";
import { usePlayer } from "@/hooks/use-player";
import { COUNTDOWN_MS, ROUNDS, botAnswersByRound, makeBots, pickWords, scoreGame, type Answer, type Player } from "@/lib/game/engine";
import { judgeSafe, submitBotsGameSafe } from "@/lib/game/api";
import { saveLocalScore } from "@/lib/game/offline";

export const Route = createFileRoute("/play/bots")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Play vs Bots — Synonym Royale" },
      { name: "description", content: "Jump straight into a 10-player synonym battle against 9 AI bots." },
      { property: "og:title", content: "Play vs Bots — Synonym Royale" },
      { property: "og:description", content: "Jump straight into a 10-player synonym battle against 9 AI bots." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BotsPage,
});

function newGame() {
  const seed = Math.floor(Math.random() * 2_000_000_000);
  return { seed, words: pickWords(seed), bots: makeBots(seed, 9), startsAt: Date.now() + COUNTDOWN_MS };
}

function BotsPage() {
  const { player } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    if (player && !player.name) navigate({ to: "/" });
  }, [player, navigate]);

  if (!player?.name) return <div className="arena-bg min-h-screen" />;
  return <BotsGame playerId={player.id} name={player.name} />;
}

function BotsGame({ playerId, name }: { playerId: string; name: string }) {
  const [game, setGame] = useState(newGame);
  const [mine, setMine] = useState<(Answer | null)[]>(() => Array(ROUNDS).fill(null));
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const mineRef = useRef(mine);
  mineRef.current = mine;

  const now = useCallback(() => Date.now(), []);

  const players: Player[] = useMemo(() => [{ id: playerId, name, isBot: false }, ...game.bots], [playerId, name, game.bots]);
  const botAnswers = useMemo(() => botAnswersByRound(game.seed, game.bots, game.words), [game]);
  const answers = useMemo(() => botAnswers.map((r, i) => ({ ...r, [playerId]: mine[i] })), [botAnswers, mine, playerId]);

  const onSubmit = useCallback(
    async (round: number, text: string, ms: number) => {
      const res = await judgeSafe(game.words[round] ?? "", text);
      if (res.ok) {
        setMine((m) => m.map((a, i) => (i === round ? { answer: res.answer, tier: res.tier, ms } : a)));
      }
      return res;
    },
    [game.words],
  );

  const onFinished = useCallback(async () => {
    const m = mineRef.current;
    const res = await submitBotsGameSafe({
      playerId,
      name,
      seed: game.seed,
      answers: m.map((a) => a?.answer ?? null),
      ms: m.map((a) => a?.ms ?? null),
    });
    if (res) {
      setFinalScore(res.score);
      return;
    }
    // Offline: score the game here and keep it on this device.
    const local = scoreGame(players, botAnswers.map((r, i) => ({ ...r, [playerId]: m[i] }))).totals[playerId] ?? 0;
    setFinalScore(local);
    saveLocalScore({ playerId, name, score: local, mode: "bots" });
    toast("Playing offline — your score is saved on this device.");
  }, [playerId, name, game.seed, players, botAnswers]);

  const playAgain = () => {
    setGame(newGame());
    setMine(Array(ROUNDS).fill(null));
    setFinalScore(null);
  };

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      <GameView
        key={game.seed}
        modeLabel="vs Bots"
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
