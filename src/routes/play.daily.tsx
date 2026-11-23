import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Trophy } from "lucide-react";
import { SiteHeader } from "@/components/game/SiteHeader";
import { BotsGame } from "@/components/game/BotsGame";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/use-player";
import { dailyKey, dailyNumber, dailySeed, msUntilNextDaily } from "@/lib/game/daily";
import { readJson, writeJson } from "@/lib/safe-storage";

const PLAYED_KEY = "sr.dailyPlayed";
type Played = { key: string; score: number | null };

export const Route = createFileRoute("/play/daily")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Daily Royale — Synonym Royale" },
      { name: "description", content: "Today's 5 words are the same for every player. One try. Climb the Daily Royale ranking." },
      { property: "og:title", content: "Daily Royale — Synonym Royale" },
      { property: "og:description", content: "Today's 5 words are the same for every player. One try. Climb the Daily Royale ranking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DailyPage,
});

function DailyPage() {
  const { player } = usePlayer();
  const navigate = useNavigate();
  const [key] = useState(() => dailyKey());
  // Read once: the game in progress must not switch to the "already played" screen.
  const [played] = useState(() => {
    const p = readJson<Played | null>(PLAYED_KEY, null);
    return p?.key === key ? p : null;
  });

  useEffect(() => {
    if (player && !player.name) navigate({ to: "/" });
  }, [player, navigate]);

  useEffect(() => {
    // Mark today as started so leaving or refreshing mid-game doesn't give a second try.
    if (!played && player?.name) writeJson(PLAYED_KEY, { key, score: null } satisfies Played);
  }, [played, player?.name, key]);

  const onScore = useCallback((score: number) => writeJson(PLAYED_KEY, { key, score } satisfies Played), [key]);

  if (!player?.name) return <div className="arena-bg min-h-screen" />;
  const number = dailyNumber(key);
  if (played) return <AlreadyPlayed number={number} score={played.score} />;
  return (
    <BotsGame
      playerId={player.id}
      name={player.name}
      seed={dailySeed(key)}
      daily={{ key, number }}
      onScore={onScore}
      onPlayAgain={() => navigate({ to: "/play/bots" })}
    />
  );
}

function AlreadyPlayed({ number, score }: { number: number; score: number | null }) {
  const [left, setLeft] = useState(() => msUntilNextDaily());
  useEffect(() => {
    const id = setInterval(() => setLeft(msUntilNextDaily()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 pb-20 pt-16 text-center">
        <CalendarCheck className="size-10 text-primary" />
        <p className="kicker mt-4">Daily Royale #{number}</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">You've played today</h1>
        <p className="mt-3 text-muted-foreground">
          {score === null ? "Your try for today is used." : (
            <>
              Your score: <span className="tabular font-bold text-foreground">{score}</span> points
            </>
          )}
        </p>
        <p className="kicker mt-8">Next Daily Royale in</p>
        <p className="tabular mt-1 font-display text-5xl font-extrabold text-primary">
          {pad(h)}:{pad(m)}:{pad(s)}
        </p>
        <div className="mt-10 grid w-full max-w-md gap-3 sm:grid-cols-2">
          <Button variant="hero" size="xl" asChild>
            <Link to="/leaderboard" search={{ period: "royale" }}>
              <Trophy /> Today's ranking
            </Link>
          </Button>
          <Button variant="arena" size="xl" asChild>
            <Link to="/play/bots">Play vs Bots</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
