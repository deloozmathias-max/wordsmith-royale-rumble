import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/game/SiteHeader";
import { GameView } from "@/components/game/GameView";
import { usePlayer } from "@/hooks/use-player";
import { COUNTDOWN_MS, ROUNDS, botAnswersByRound, makeBots, pickWords, scoreGame, type Answer, type Player } from "@/lib/game/engine";
import { judgeSafe, submitBotsGameSafe } from "@/lib/game/api";
import { saveLocalScore } from "@/lib/game/offline";
import { newSeed, parseChallengeSearch, type ChallengeSearch } from "@/lib/game/challenge";

export const Route = createFileRoute("/play/bots")({
  ssr: false,
  validateSearch: parseChallengeSearch,
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

function newGame(fixedSeed?: number) {
  const seed = fixedSeed ?? newSeed();
  return { seed, words: pickWords(seed), bots: makeBots(seed, 9), startsAt: Date.now() + COUNTDOWN_MS };
}

function BotsPage() {
  const { player } = usePlayer();
  const search = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    // No name yet: a challenge link goes to the challenge page to pick one, otherwise home.
    if (player && !player.name) {
      if (search.seed !== undefined) navigate({ to: "/challenge", search });
      else navigate({ to: "/" });
    }
  }, [player, navigate, search]);

  if (!player?.name) return <div className="arena-bg min-h-screen" />;
  return (
    <BotsGame
      key={search.seed ?? "random"}
      playerId={player.id}
      name={player.name}
      search={search}
      onLeaveChallenge={() => navigate({ to: "/play/bots", search: {} })}
    />
  );
}

function BotsGame({
  playerId,
  name,
  search,
  onLeaveChallenge,
}: {
  playerId: string;
  name: string;
  search: ChallengeSearch;
  onLeaveChallenge: () => void;
}) {
  const [game, setGame] = useState(() => newGame(search.seed));
  const challenge =
    search.targetScore !== undefined || search.challenger
      ? { challenger: search.challenger ?? null, targetScore: search.targetScore ?? null }
      : null;
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
    // Fixed-seed games (challenges) start a fresh random game instead of replaying the same words.
    if (search.seed !== undefined) return onLeaveChallenge();
    setGame(newGame());
    setMine(Array(ROUNDS).fill(null));
    setFinalScore(null);
  };

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      <GameView
        key={game.seed}
        modeLabel={challenge ? `Challenge from ${challenge.challenger ?? "a friend"}` : "vs Bots"}
        seed={game.seed}
        challenge={challenge}
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
