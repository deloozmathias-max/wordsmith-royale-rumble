import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BotsGame } from "@/components/game/BotsGame";
import { usePlayer } from "@/hooks/use-player";
import { parseChallengeSearch } from "@/lib/game/challenge";

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
  const challenge =
    search.targetScore !== undefined || search.challenger
      ? { challenger: search.challenger ?? null, targetScore: search.targetScore ?? null }
      : null;
  return (
    <BotsGame
      key={search.seed ?? "random"}
      playerId={player.id}
      playerKey={player.key}
      name={player.name}
      {...(search.seed !== undefined
        ? // Fixed-seed games (challenges) start a fresh random game instead of replaying the same words.
          { seed: search.seed, onPlayAgain: () => navigate({ to: "/play/bots", search: {} }) }
        : {})}
      challenge={challenge}
    />
  );
}
