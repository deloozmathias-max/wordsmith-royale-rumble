import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, UserRound, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/game/SiteHeader";
import { GameView } from "@/components/game/GameView";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/use-player";
import { PLAYERS_PER_GAME, botAnswersByRound, makeBots, type Answer, type Player } from "@/lib/game/engine";
import {
  finishOnlineGame,
  getLobbyState,
  joinMatchmaking,
  leaveLobby,
  startLobby,
  submitOnlineAnswer,
} from "@/lib/game/game.functions";
import { OFFLINE_ONLY } from "@/lib/game/api";

export const Route = createFileRoute("/play/online")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Online Match — Synonym Royale" },
      { name: "description", content: "Get matched with real players in a 10-player synonym battle. Empty seats fill with bots." },
      { property: "og:title", content: "Online Match — Synonym Royale" },
      { property: "og:description", content: "Get matched with real players in a 10-player synonym battle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnlinePage,
});

function OnlinePage() {
  const { player } = usePlayer();
  const navigate = useNavigate();
  const [session, setSession] = useState<{ lobbyId: string; offset: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (player && !player.name) navigate({ to: "/" });
  }, [player, navigate]);

  const offline = OFFLINE_ONLY || !!player?.offline;

  useEffect(() => {
    if (!player?.name || offline) return;
    let cancelled = false;
    setError(null);
    const sent = Date.now();
    joinMatchmaking({ data: { playerId: player.id, playerKey: player.key, name: player.name } })
      .then((r) => {
        if (cancelled) return;
        const latency = (Date.now() - sent) / 2;
        setSession({ lobbyId: r.lobbyId, offset: r.serverNow + latency - Date.now() });
      })
      .catch(() => !cancelled && setError("Couldn't reach the matchmaker. Please try again."));
    return () => {
      cancelled = true;
    };
  }, [player?.id, player?.key, player?.name, attempt, offline]);

  return (
    <div className="arena-bg min-h-screen">
      <SiteHeader />
      {offline ? (
        <OfflineNotice />
      ) : !player?.name || !session ? (
        <div className="flex flex-col items-center px-4 py-24 text-center">
          {error ? (
            <>
              <p className="text-destructive">{error}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="hero" onClick={() => setAttempt((a) => a + 1)}>
                  Try again
                </Button>
                <Button variant="arena" asChild>
                  <Link to="/play/bots">Play vs Bots instead</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="kicker mt-4">Connecting to matchmaker</p>
            </>
          )}
        </div>
      ) : (
        <OnlineMatch
          key={session.lobbyId}
          lobbyId={session.lobbyId}
          offset={session.offset}
          playerId={player.id}
          playerKey={player.key}
          onPlayAgain={() => {
            setSession(null);
            setAttempt((a) => a + 1);
          }}
        />
      )}
    </div>
  );
}

function OnlineMatch({
  lobbyId,
  offset,
  playerId,
  playerKey,
  onPlayAgain,
}: {
  lobbyId: string;
  offset: number;
  playerId: string;
  playerKey: string;
  onPlayAgain: () => void;
}) {
  const queryClient = useQueryClient();
  const now = useCallback(() => Date.now() + offset, [offset]);
  const start = startLobby;
  const leave = leaveLobby;
  const finish = finishOnlineGame;
  const [mine, setMine] = useState<Record<number, Answer>>({});
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const { data, failureCount } = useQuery({
    queryKey: ["lobby", lobbyId],
    queryFn: () => getLobbyState({ data: { lobbyId, playerId, playerKey } }),
    refetchInterval: done ? false : 1500,
    retry: 2,
  });

  const status = data?.lobby.status;
  const statusRef = useRef(status);
  statusRef.current = status;

  // Leave the lobby if the player walks away while still waiting.
  useEffect(() => {
    return () => {
      if (statusRef.current === "waiting") leave({ data: { lobbyId, playerId, playerKey } }).catch(() => {});
    };
  }, [lobbyId, playerId, playerKey, leave]);

  // When the wait time is over, any client may trigger the start (bots fill empty seats).
  const fillAt = data?.lobby.fill_at ? new Date(data.lobby.fill_at).getTime() : null;
  useEffect(() => {
    if (status !== "waiting" || !fillAt) return;
    const id = setInterval(() => {
      if (now() >= fillAt) {
        start({ data: { lobbyId } })
          .then(() => queryClient.invalidateQueries({ queryKey: ["lobby", lobbyId] }))
          .catch(() => {});
      }
    }, 1000);
    return () => clearInterval(id);
  }, [status, fillAt, lobbyId, now, start, queryClient]);

  const game = useMemo(() => {
    if (!data || data.lobby.status !== "playing" || !data.lobby.starts_at) return null;
    const words = data.lobby.words as string[];
    const humans: Player[] = data.players.map((p) => ({ id: p.player_id, name: p.name, isBot: false }));
    const bots = makeBots(data.lobby.seed, data.lobby.bot_count);
    return {
      words,
      players: [...humans, ...bots],
      bots,
      seed: data.lobby.seed,
      startsAt: new Date(data.lobby.starts_at).getTime(),
    };
  }, [data]);

  const botAnswers = useMemo(
    () => (game ? botAnswersByRound(game.seed, game.bots, game.words) : []),
    [game],
  );
  const answers = useMemo(() => {
    if (!game || !data) return [];
    const rounds = botAnswers.map((r) => ({ ...r })) as Record<string, Answer | null>[];
    for (const a of data.answers) {
      const slot = rounds[a.round];
      if (slot) slot[a.player_id] = { answer: a.answer, tier: a.tier, ms: a.ms };
    }
    for (const [r, a] of Object.entries(mine)) {
      const slot = rounds[Number(r)];
      if (slot) slot[playerId] ??= a;
    }
    return rounds;
  }, [game, data, botAnswers, mine, playerId]);

  const onSubmit = useCallback(
    async (round: number, text: string, ms: number) => {
      try {
        const res = await submitOnlineAnswer({ data: { lobbyId, playerId, playerKey, round, answer: text } });
        if (res.ok) setMine((m) => ({ ...m, [round]: { answer: res.answer, tier: res.tier, ms } }));
        return res;
      } catch {
        return { ok: false as const, error: "Connection lost — your answer didn't go through." };
      }
    },
    [lobbyId, playerId, playerKey],
  );

  const onFinished = useCallback(async () => {
    setDone(true);
    // Small delay so late answers from other players are in.
    await new Promise((r) => setTimeout(r, 800));
    await queryClient.invalidateQueries({ queryKey: ["lobby", lobbyId] });
    try {
      const res = await finish({ data: { lobbyId, playerId, playerKey } });
      setFinalScore(res.score);
    } catch {
      toast.error("Couldn't save your score to the leaderboard.");
      setFinalScore(0);
    }
  }, [finish, lobbyId, playerId, playerKey, queryClient]);

  if (!data && failureCount >= 3) {
    return (
      <div className="flex flex-col items-center px-4 py-24 text-center">
        <p className="text-destructive">Lost connection to the game server.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="hero" onClick={onPlayAgain}>
            Try again
          </Button>
          <Button variant="arena" asChild>
            <Link to="/play/bots">Play vs Bots instead</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return <WaitingRoom players={data.players} playerId={playerId} fillAt={fillAt} now={now} />;
  }

  return (
    <GameView
      modeLabel="Online match"
      seed={game.seed}
      words={game.words}
      players={game.players}
      youId={playerId}
      startsAt={game.startsAt}
      now={now}
      answers={answers}
      onSubmit={onSubmit}
      onFinished={onFinished}
      finalScore={finalScore}
      onPlayAgain={onPlayAgain}
    />
  );
}

function OfflineNotice() {
  return (
    <div className="animate-rise mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <WifiOff className="size-8 text-muted-foreground" />
      <h1 className="mt-4 font-display text-3xl font-extrabold">You're playing offline</h1>
      <p className="mt-2 text-muted-foreground">
        Online matches need the game server, which can't be reached right now. You can still battle 9 bots — your scores are
        saved on this device.
      </p>
      <Button variant="hero" size="lg" className="mt-6" asChild>
        <Link to="/play/bots">Play vs Bots</Link>
      </Button>
    </div>
  );
}

function WaitingRoom({
  players,
  playerId,
  fillAt,
  now,
}: {
  players: { player_id: string; name: string }[];
  playerId: string;
  fillAt: number | null;
  now: () => number;
}) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), 250);
    return () => clearInterval(id);
  }, [now]);
  const secs = fillAt ? Math.max(0, Math.ceil((fillAt - t) / 1000)) : 0;
  const empty = PLAYERS_PER_GAME - players.length;

  return (
    <main className="animate-rise mx-auto max-w-3xl px-4 pb-16 pt-10 text-center">
      <p className="kicker">Matchmaking</p>
      <h1 className="mt-3 font-display text-5xl font-extrabold sm:text-6xl">
        <span className="tabular text-primary">{players.length}</span>
        <span className="text-muted-foreground">/{PLAYERS_PER_GAME}</span> players
      </h1>
      <p className="mt-3 text-muted-foreground">
        {secs > 0 ? (
          <>
            Waiting for real players · bots fill {empty} empty seat{empty === 1 ? "" : "s"} in{" "}
            <span className="tabular font-semibold text-foreground">{secs}s</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Filling seats with bots…
          </span>
        )}
      </p>

      <ul className="mt-10 grid grid-cols-2 gap-2 text-left sm:grid-cols-5">
        {Array.from({ length: PLAYERS_PER_GAME }).map((_, i) => {
          const p = players[i];
          if (!p)
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground"
              >
                <Bot className="size-4 opacity-50" />
                <span className="animate-blink">open seat</span>
              </li>
            );
          const isYou = p.player_id === playerId;
          return (
            <li
              key={p.player_id}
              className={`animate-pop flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
                isYou ? "border-primary/50 bg-primary/5" : "border-border bg-surface"
              }`}
            >
              <UserRound className="size-4 shrink-0 text-primary" />
              <span className="truncate font-medium">
                {p.name}
                {isYou && <span className="ml-1 text-primary">(you)</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <Button variant="arena" size="lg" className="mt-10" asChild>
        <Link to="/">Leave lobby</Link>
      </Button>
    </main>
  );
}
