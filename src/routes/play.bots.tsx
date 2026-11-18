import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/game/SiteHeader";
import { GameView } from "@/components/game/GameView";
import { usePlayer } from "@/hooks/use-player";
import { COUNTDOWN_MS, ROUNDS, botAnswersByRound, makeBots, pickWords, scoreGame, type Answer, type Player } from "@/lib/game/engine";
import { judgeSynonym, submitBotsGame } from "@/lib/game/game.functions";

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

  const judge = useServerFn(judgeSynonym);
  const saveGame = useServerFn(submitBotsGame);
  const now = useCallback(() => Date.now(), []);

  const players: Player[] = useMemo(() => [{ id: playerId, name, isBot: false }, ...game.bots], [playerId, name, game.bots]);
  const botAnswers = useMemo(() => botAnswersByRound(game.seed, game.bots, game.words), [game]);
  const answers = useMemo(() => botAnswers.map((r, i) => ({ ...r, [playerId]: mine[i] })), [botAnswers, mine, playerId]);

  const onSubmit = useCallback(
    async (round: number, text: string, ms: number) => {
      const res = await judge({ data: { word: game.words[round] ?? "", answer: text } });
      if (res.ok) {
        setMine((m) => m.map((a, i) => (i === round ? { answer: res.answer, tier: res.tier, ms } : a)));
      }
      return res;
    },
    [judge, game.words],
  );

  const onFinished = useCallback(async () => {
    const m = mineRef.current;
    try {
      const res = await saveGame({
        data: { playerId, name, seed: game.seed, answers: m.map((a) => a?.answer ?? null), ms: m.map((a) => a?.ms ?? null) },
      });
      setFinalScore(res.score);
    } catch {
      const local = scoreGame(players, botAnswers.map((r, i) => ({ ...r, [playerId]: m[i] }))).totals[playerId];
      setFinalScore(local ?? 0);
      toast.error("Couldn't save your score to the leaderboard.");
    }
  }, [saveGame, playerId, name, game.seed, players, botAnswers]);

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
