import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Swords, UserMinus, UserPlus, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/game/SiteHeader";
import { ShareDialog } from "@/components/game/ShareDialog";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/use-player";
import { useChallengeLink } from "@/hooks/use-challenge-link";
import { listFriendsSafe, searchPlayersSafe, setFriendSafe } from "@/lib/game/api";
import { newSeed } from "@/lib/game/challenge";
import type { FriendRow } from "@/lib/game/game.functions";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — Synonym Royale" },
      { name: "description", content: "Find players by name, add friends and challenge them to a synonym duel." },
      { property: "og:title", content: "Friends — Synonym Royale" },
      { property: "og:description", content: "Find players by name, add friends and challenge them to a synonym duel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

function lastSeenLabel(iso: string): { text: string; online: boolean } {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 10) return { text: "Online", online: true };
  if (mins < 60) return { text: `${Math.round(mins)} min ago`, online: false };
  if (mins < 1440) return { text: `${Math.round(mins / 60)} h ago`, online: false };
  return { text: `${Math.round(mins / 1440)} d ago`, online: false };
}

function FriendsPage() {
  const { player } = usePlayer();
  const challengeLink = useChallengeLink();
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const auth = player && !player.offline && player.key ? { playerId: player.id, key: player.key } : null;

  const refresh = useCallback(async () => {
    if (!auth) return;
    setFriends((await listFriendsSafe(auth)) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.playerId, auth?.key]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!auth || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      setResults((await searchPlayersSafe(auth, query)) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, auth?.playerId]);

  async function toggle(f: FriendRow, add: boolean) {
    if (!auth) return;
    const r = await setFriendSafe(auth, f.id, add).catch(() => null);
    if (!r) return toast.error("Couldn't update friends. Try again.");
    toast.success(add ? `${f.name} added to your friends` : `${f.name} removed`);
    void refresh();
  }

  function challenge(f: FriendRow) {
    setLink({ name: f.name, url: challengeLink({ seed: newSeed(), ...(player?.name ? { challenger: player.name } : {}) }) });
  }

  const friendIds = new Set((friends ?? []).map((f) => f.id));

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8">
        <p className="kicker">Your crew</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold sm:text-5xl">Friends</h1>

        {!player ? (
          <Loader2 className="mt-10 size-6 animate-spin text-muted-foreground" />
        ) : !auth ? (
          <div className="panel mt-8 flex items-center gap-3 p-5 text-muted-foreground">
            <WifiOff className="size-5 shrink-0" /> Friends need the online version of the game.
          </div>
        ) : !player.name ? (
          <div className="panel mt-8 p-5">
            <p className="text-muted-foreground">Pick a player name first so friends can find you.</p>
            <Button asChild variant="hero" className="mt-4">
              <Link to="/">Choose a name</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              You are <span className="font-semibold text-foreground">{player.name}</span>. Names unused for 7 days are released —
              your friends stay either way.
            </p>

            <div className="relative mt-6">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a player name…"
                maxLength={16}
                aria-label="Search players"
                className="h-12 w-full rounded-xl border border-input bg-background pl-12 pr-4 font-semibold outline-none focus:border-primary"
              />
            </div>
            {query.trim().length >= 2 && (
              <ul className="panel mt-2 divide-y divide-border overflow-hidden">
                {searching ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">Searching…</li>
                ) : results.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">No player with that name.</li>
                ) : (
                  results.map((r) => (
                    <PlayerRow key={r.id} f={r}>
                      {friendIds.has(r.id) ? (
                        <span className="text-xs font-semibold text-primary">Friend</span>
                      ) : (
                        <Button size="sm" variant="arena" onClick={() => toggle(r, true)}>
                          <UserPlus /> Add
                        </Button>
                      )}
                    </PlayerRow>
                  ))
                )}
              </ul>
            )}

            <div className="mt-8 flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <p className="kicker">Your friends {friends ? `(${friends.length})` : ""}</p>
            </div>
            <ul className="panel mt-3 divide-y divide-border overflow-hidden">
              {friends === null ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">Loading…</li>
              ) : friends.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">No friends yet — search a name above.</li>
              ) : (
                friends.map((f) => (
                  <PlayerRow key={f.id} f={f}>
                    <Button size="sm" variant="hero" onClick={() => challenge(f)}>
                      <Swords /> Challenge
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => toggle(f, false)}>
                      <UserMinus />
                    </Button>
                  </PlayerRow>
                ))
              )}
            </ul>
          </>
        )}
      </main>
      <ShareDialog
        open={!!link}
        onOpenChange={(o) => !o && setLink(null)}
        title={`Challenge ${link?.name ?? ""}`}
        description="Send this link: you both get the same 5 words and bots. Play it too and compare scores!"
        text={link?.url ?? ""}
      />
    </div>
  );
}

function PlayerRow({ f, children }: { f: FriendRow; children: React.ReactNode }) {
  const seen = lastSeenLabel(f.lastSeen);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={`size-2 shrink-0 rounded-full ${seen.online ? "bg-primary" : "bg-muted-foreground/40"}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{f.name}</span>
        <span className="text-xs text-muted-foreground">{seen.text}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </li>
  );
}
