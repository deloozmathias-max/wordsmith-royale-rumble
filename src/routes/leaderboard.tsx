import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Crown, WifiOff } from "lucide-react";
import { SiteHeader } from "@/components/game/SiteHeader";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/use-player";
import type { LeaderboardRow } from "@/lib/game/game.functions";
import { leaderboardSafe } from "@/lib/game/api";
import { buildLeaderboard, readLocalScores } from "@/lib/game/offline";

type Period = "all" | "weekly" | "daily";
const PERIODS: { id: Period; label: string; hint: string }[] = [
  { id: "all", label: "All-Time", hint: "Total score across every game" },
  { id: "weekly", label: "Weekly", hint: "Best players since Monday (UTC)" },
  { id: "daily", label: "Daily", hint: "Today's top players (UTC)" },
];

const leaderboardQuery = (period: Period) =>
  queryOptions({
    queryKey: ["leaderboard", period],
    queryFn: () => leaderboardSafe(period),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/leaderboard")({
  validateSearch: (s: Record<string, unknown>): { period: Period } => ({
    period: s["period"] === "weekly" || s["period"] === "daily" ? s["period"] : "all",
  }),
  loaderDeps: ({ search }) => ({ period: search.period }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(leaderboardQuery(deps.period)),
  head: () => ({
    meta: [
      { title: "Leaderboard — Synonym Royale" },
      { name: "description", content: "The best synonym finders: all-time, this week and today." },
      { property: "og:title", content: "Leaderboard — Synonym Royale" },
      { property: "og:description", content: "The best synonym finders: all-time, this week and today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { period } = Route.useSearch();
  const { data } = useSuspenseQuery(leaderboardQuery(period));
  const { player } = usePlayer();
  const current = PERIODS.find((p) => p.id === period)!;
  const medal = ["text-gold", "text-silver", "text-bronze"];
  // Offline: show the scores saved on this device (read after load so the first render matches).
  const [localRows, setLocalRows] = useState<LeaderboardRow[]>([]);
  useEffect(() => {
    if (data.offline) setLocalRows(buildLeaderboard(readLocalScores(), period));
  }, [data.offline, period]);
  const rows = data.offline ? localRows : data.rows;

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10">
        <p className="kicker">Global rankings</p>
        <h1 className="mt-2 font-display text-5xl font-extrabold sm:text-6xl">Leaderboard</h1>

        <div role="tablist" aria-label="Period" className="mt-8 inline-flex rounded-xl border border-border bg-surface p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              role="tab"
              aria-selected={p.id === period}
              to="/leaderboard"
              search={{ period: p.id }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                p.id === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{current.hint}</p>

        {data.offline && (
          <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
            <WifiOff className="size-4" /> Offline — showing scores saved on this device.
          </p>
        )}

        {rows.length === 0 ? (
          <div className="panel mt-6 flex flex-col items-center px-6 py-14 text-center">
            <Crown className="size-8 text-gold" />
            <p className="mt-4 font-display text-2xl font-bold">The throne is empty</p>
            <p className="mt-1 text-muted-foreground">Play a game to claim the first spot.</p>
            <Button variant="hero" size="lg" className="mt-6" asChild>
              <Link to="/">Play now</Link>
            </Button>
          </div>
        ) : (
          <ol className="panel mt-6 divide-y divide-border overflow-hidden">
            <li className="kicker flex items-center gap-3 px-4 py-3">
              <span className="w-8">#</span>
              <span className="flex-1">Player</span>
              <span className="hidden w-16 text-right sm:block">Games</span>
              <span className="hidden w-16 text-right sm:block">Best</span>
              <span className="w-20 text-right">Points</span>
            </li>
            {rows.map((r, i) => {
              const isYou = player?.id === r.player_id;
              return (
                <li
                  key={r.player_id}
                  className={`animate-rise flex items-center gap-3 px-4 py-3 ${isYou ? "bg-primary/5" : ""}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                >
                  <span className={`tabular w-8 font-bold ${medal[i] ?? "text-muted-foreground"}`}>{i + 1}</span>
                  <span className="flex-1 truncate font-medium">
                    {r.name}
                    {isYou && <span className="ml-1 text-primary">(you)</span>}
                  </span>
                  <span className="tabular hidden w-16 text-right text-sm text-muted-foreground sm:block">{r.games}</span>
                  <span className="tabular hidden w-16 text-right text-sm text-muted-foreground sm:block">{r.best}</span>
                  <span className="tabular w-20 text-right text-lg font-bold text-primary">{r.total}</span>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
