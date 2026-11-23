import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, CalendarDays, Globe2, Sparkles, Swords, Timer, Users } from "lucide-react";
import { SiteHeader } from "@/components/game/SiteHeader";
import { NameField } from "@/components/game/NameField";
import { ShareDialog } from "@/components/game/ShareDialog";
import { Button } from "@/components/ui/button";
import { useChallengeLink } from "@/hooks/use-challenge-link";
import { newSeed } from "@/lib/game/challenge";
import { dailyKey, dailyNumber } from "@/lib/game/daily";
import { usePlayer } from "@/hooks/use-player";
import { validatePlayerName } from "@/lib/game/filter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Synonym Royale — the 10-player synonym battle" },
      {
        name: "description",
        content: "Find the best English synonym in 20 seconds. Battle 9 bots or real players over 5 rounds and climb the daily leaderboard.",
      },
      { property: "og:title", content: "Synonym Royale — the 10-player synonym battle" },
      {
        property: "og:description",
        content: "Find the best English synonym in 20 seconds. 10 players, 5 rounds, one champion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { player, saveName } = usePlayer();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = draft ?? player?.name ?? "";
  const challengeLink = useChallengeLink();
  const [challenge, setChallenge] = useState<{ seed: number; link: string } | null>(null);

  async function checkName() {
    const r = validatePlayerName(name);
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    const taken = await saveName(r.value);
    if (taken) {
      setError(taken);
      return null;
    }
    return r.value;
  }

  async function go(to: "/play/bots" | "/play/online" | "/play/daily") {
    if (await checkName()) navigate({ to });
  }

  async function makeChallenge() {
    const n = await checkName();
    if (!n) return;
    const seed = newSeed();
    setChallenge({ seed, link: challengeLink({ seed, challenger: n }) });
  }

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:pt-16">
        <section className="animate-rise">
          <p className="kicker">10 players · 5 rounds · 20 seconds</p>
          <h1 className="mt-4 font-display text-[3.4rem] font-extrabold leading-[0.88] sm:text-[6.5rem]">
            Say it
            <br />
            <span className="text-outline">differently.</span>
            <br />
            <span className="text-primary">Win it.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            One English word appears. Type the sharpest synonym before the clock runs out. Pick one nobody else thought
            of and grab a <span className="font-semibold text-accent">+10 uniqueness bonus</span>.
          </p>
        </section>

        <section className="panel animate-rise mt-10 grid gap-8 p-5 sm:p-8 md:grid-cols-[1fr_1.2fr]" style={{ animationDelay: "80ms" }}>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              icon={<Bot className="size-5" />}
              title="Play vs Bots"
              text="Start instantly against 9 AI players."
              cta="Play now"
              primary
              onClick={() => go("/play/bots")}
            />
            <ModeCard
              icon={<Globe2 className="size-5" />}
              title="Online"
              text="Match with real players. Empty seats fill with bots."
              cta="Find a match"
              onClick={() => go("/play/online")}
            />
            <button
              type="button"
              onClick={() => go("/play/daily")}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-primary/50 bg-primary/10 px-5 py-4 text-left transition-all hover:border-primary active:scale-[0.98] sm:col-span-2"
            >
              <span className="flex items-center gap-3">
                <CalendarDays className="size-5 text-primary" />
                <span>
                  <span className="block font-display text-lg font-bold">
                    Daily Royale <span className="text-primary">#{dailyNumber(dailyKey())}</span>
                  </span>
                  <span className="block text-sm text-muted-foreground">Same 5 words for everyone today. One try.</span>
                </span>
              </span>
              <span className="font-display font-bold text-primary transition-transform group-hover:translate-x-1">→</span>
            </button>
            <button
              type="button"
              onClick={makeChallenge}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-left transition-all hover:border-accent active:scale-[0.98] sm:col-span-2"
            >
              <span className="flex items-center gap-3">
                <Swords className="size-5 text-accent" />
                <span>
                  <span className="block font-display text-lg font-bold">Challenge a Friend</span>
                  <span className="block text-sm text-muted-foreground">Send a link: same 5 words, same bots.</span>
                </span>
              </span>
              <span className="font-display font-bold text-accent transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </section>

        <ShareDialog
          open={!!challenge}
          onOpenChange={(o) => !o && setChallenge(null)}
          title="Challenge a Friend"
          description="Send this link. Your friend plays the exact same 5 words against the same 9 bots — then compare scores."
          text={challenge?.link ?? ""}
        >
          <Button
            variant="arena"
            onClick={() => challenge && navigate({ to: "/play/bots", search: { seed: challenge.seed } })}
          >
            <Bot /> Play these words now
          </Button>
        </ShareDialog>

        <section className="mt-12 grid gap-3 sm:grid-cols-3">
          <Rule icon={<Timer className="size-5" />} title="20 seconds" text="Each round shows one word. Lock in a single synonym." />
          <Rule
            icon={<Users className="size-5" />}
            title="Quality counts"
            text="Perfect 30 · Good 20 · Fair 10. Off-target words score 0."
          />
          <Rule
            icon={<Sparkles className="size-5" />}
            title="Be unique"
            text="Nobody else in the round chose your word? +10 bonus."
          />
        </section>
      </main>
    </div>
  );
}

function ModeCard(props: { icon: React.ReactNode; title: string; text: string; cta: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`group flex flex-col justify-between gap-6 rounded-2xl border p-5 text-left transition-all active:scale-[0.98] ${
        props.primary
          ? "border-primary bg-primary text-primary-foreground shadow-glow hover:brightness-105"
          : "border-border bg-secondary/50 hover:border-primary/50 hover:bg-secondary"
      }`}
    >
      <div>
        <span
          className={`inline-flex size-10 items-center justify-center rounded-xl ${
            props.primary ? "bg-primary-foreground/10" : "bg-background/60 text-primary"
          }`}
        >
          {props.icon}
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">{props.title}</h2>
        <p className={`mt-1 text-sm ${props.primary ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{props.text}</p>
      </div>
      <span className="font-display font-bold">
        {props.cta} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
      </span>
    </button>
  );
}

function Rule({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5">
      <span className="text-primary">{icon}</span>
      <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
