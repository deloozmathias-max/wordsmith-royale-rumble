import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, Swords, Target } from "lucide-react";
import { SiteHeader } from "@/components/game/SiteHeader";
import { NameField } from "@/components/game/NameField";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/use-player";
import { parseChallengeSearch } from "@/lib/game/challenge";
import { validatePlayerName } from "@/lib/game/filter";

export const Route = createFileRoute("/challenge")({
  validateSearch: parseChallengeSearch,
  head: () => ({
    meta: [
      { title: "You've been challenged — Synonym Royale" },
      {
        name: "description",
        content: "A friend challenged you to Synonym Royale: same 5 words, same 9 bots. Can you beat their score?",
      },
      { property: "og:title", content: "You've been challenged — Synonym Royale" },
      { property: "og:description", content: "Same 5 words, same 9 bots. Can you beat your friend's synonym score?" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChallengePage,
});

function ChallengePage() {
  const search = Route.useSearch();
  const { player, saveName } = usePlayer();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = draft ?? player?.name ?? "";
  const who = search.challenger ?? "A friend";

  function accept() {
    const r = validatePlayerName(name);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    saveName(r.value);
    navigate({ to: "/play/bots", search });
  }

  if (search.seed === undefined) {
    return (
      <div className="arena-bg min-h-screen">
        <SiteHeader />
        <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
          <h1 className="font-display text-4xl font-extrabold">This challenge link is broken</h1>
          <p className="mt-3 text-muted-foreground">Ask your friend to send it again, or start your own game.</p>
          <Button variant="hero" size="xl" className="mt-8" asChild>
            <Link to="/">Back to start</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:pt-16">
        <section className="animate-rise">
          <p className="kicker flex items-center gap-2">
            <Swords className="size-4" /> Friend challenge
          </p>
          <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] sm:text-7xl">
            <span className="text-primary">{who}</span> challenged you.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            You get the exact same 5 words and the same 9 bots. Highest score wins bragging rights.
          </p>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface/60 p-5">
            <Target className="size-5 text-primary" />
            <p className="kicker mt-3">Score to beat</p>
            <p className="tabular mt-1 text-4xl font-bold">{search.targetScore ?? "—"}</p>
            {search.targetScore === undefined && (
              <p className="mt-1 text-sm text-muted-foreground">No score yet — play and compare afterwards.</p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-surface/60 p-5">
            <Bot className="size-5 text-primary" />
            <p className="kicker mt-3">Format</p>
            <p className="mt-1 font-display text-2xl font-bold">You + 9 bots</p>
            <p className="mt-1 text-sm text-muted-foreground">5 rounds · 20 seconds each</p>
          </div>
        </section>

        <section className="panel animate-rise mt-6 grid gap-6 p-5 sm:p-8">
          <NameField
            initial={player?.name ?? ""}
            error={error}
            onChange={(v) => {
              setDraft(v);
              setError(null);
            }}
            onUseSuggestion={(v) => {
              setDraft(v);
              setError(null);
            }}
          />
          <Button variant="hero" size="xl" onClick={accept}>
            <Swords /> Accept challenge
          </Button>
        </section>
      </main>
    </div>
  );
}
