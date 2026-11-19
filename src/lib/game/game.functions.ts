import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { judgeAnswer } from "./judge.server";
import { sanitizePlayerName } from "./filter";
import { assertPlayer, createPlayerKey } from "./player-auth.server";
import {
  RESULTS_MS,
  gameEndsAt,
  ROUNDS,
  ROUND_MS,
  MAX_GAME_SCORE,
  botAnswersByRound,
  makeBots,
  pickWords,
  scoreGame,
  type Answer,
  type Player,
} from "./engine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WAIT_SECONDS = 20;

function assertUuid(v: unknown, label: string): string {
  if (typeof v !== "string" || !UUID.test(v)) throw new Error(`Invalid ${label}`);
  return v;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function readKey(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 64) : "";
}

/** Issues a new player identity with a secret key kept only on the player's device. */
export const registerPlayer = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  return createPlayerKey(db);
});

export const getServerTime = createServerFn({ method: "GET" }).handler(async () => ({ now: Date.now() }));

/** Rates a synonym (used by Play vs Bots). */
export const judgeSynonym = createServerFn({ method: "POST" })
  .inputValidator((d: { word: string; answer: string }) => {
    if (typeof d?.word !== "string" || typeof d?.answer !== "string") throw new Error("Invalid input");
    return { word: d.word.slice(0, 40), answer: d.answer.slice(0, 60) };
  })
  .handler(async ({ data }) => judgeAnswer(data.word, data.answer));

/** Records a finished vs-bots game. The server replays the game to compute the score. */
export const submitBotsGame = createServerFn({ method: "POST" })
  .inputValidator((d: { playerId: string; name: string; seed: number; answers: (string | null)[]; ms: (number | null)[] }) => {
    assertUuid(d?.playerId, "player");
    if (!Number.isInteger(d.seed)) throw new Error("Invalid seed");
    if (!Array.isArray(d.answers) || d.answers.length !== ROUNDS) throw new Error("Invalid answers");
    return {
      playerId: d.playerId,
      name: String(d.name ?? "").slice(0, 32),
      seed: d.seed,
      answers: d.answers.map((a) => (typeof a === "string" ? a.slice(0, 40) : null)),
      ms: d.ms.map((m) => (typeof m === "number" ? Math.max(0, Math.min(ROUND_MS, Math.round(m))) : 0)),
    };
  })
  .handler(async ({ data }) => {
    const words = pickWords(data.seed);
    const you: Player = { id: data.playerId, name: sanitizePlayerName(data.name), isBot: false };
    const bots = makeBots(data.seed, 9);
    const byRound = botAnswersByRound(data.seed, bots, words) as Record<string, Answer | null>[];
    for (let r = 0; r < ROUNDS; r++) {
      const raw = data.answers[r];
      const word = words[r];
      const slot = byRound[r];
      if (!raw || !word || !slot) continue;
      const j = await judgeAnswer(word, raw);
      slot[you.id] = j.ok ? { answer: j.answer, tier: j.tier, ms: data.ms[r] ?? 0 } : null;
    }
    const { totals } = scoreGame([you, ...bots], byRound);
    const score = Math.min(MAX_GAME_SCORE, totals[you.id] ?? 0);
    const db = await admin();
    await db.from("scores").upsert(
      { game_key: `bots:${data.playerId}:${data.seed}`, player_id: data.playerId, name: you.name, score, mode: "bots" },
      { onConflict: "game_key", ignoreDuplicates: true },
    );
    return { score };
  });

export const joinMatchmaking = createServerFn({ method: "POST" })
  .inputValidator((d: { playerId: string; playerKey: string; name: string }) => ({
    playerId: assertUuid(d?.playerId, "player"),
    playerKey: readKey(d?.playerKey),
    name: String(d?.name ?? "").slice(0, 32),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.playerKey);
    const seed = Math.floor(Math.random() * 2_000_000_000);
    const { data: lobbyId, error } = await db.rpc("join_matchmaking", {
      p_player_id: data.playerId,
      p_name: sanitizePlayerName(data.name),
      p_seed: seed,
      p_words: pickWords(seed),
      p_wait_seconds: WAIT_SECONDS,
    });
    if (error || !lobbyId) {
      console.error(error);
      throw new Error("Could not join a lobby right now. Please try again.");
    }
    return { lobbyId: lobbyId as string, serverNow: Date.now() };
  });

export const leaveLobby = createServerFn({ method: "POST" })
  .inputValidator((d: { lobbyId: string; playerId: string; playerKey: string }) => ({
    lobbyId: assertUuid(d?.lobbyId, "lobby"),
    playerId: assertUuid(d?.playerId, "player"),
    playerKey: readKey(d?.playerKey),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.playerKey);
    const { data: lobby } = await db.from("lobbies").select("status").eq("id", data.lobbyId).maybeSingle();
    if (lobby?.status === "waiting") {
      await db.from("lobby_players").delete().eq("lobby_id", data.lobbyId).eq("player_id", data.playerId);
    }
    return { ok: true };
  });

/** Called by any client once the wait time is over: fills the lobby with bots and starts it. */
export const startLobby = createServerFn({ method: "POST" })
  .inputValidator((d: { lobbyId: string }) => ({ lobbyId: assertUuid(d?.lobbyId, "lobby") }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.rpc("start_lobby", { p_lobby: data.lobbyId });
    if (error) console.error(error);
    return { ok: !error };
  });

export const submitOnlineAnswer = createServerFn({ method: "POST" })
  .inputValidator((d: { lobbyId: string; playerId: string; playerKey: string; round: number; answer: string }) => {
    if (!Number.isInteger(d?.round) || d.round < 0 || d.round >= ROUNDS) throw new Error("Invalid round");
    return {
      lobbyId: assertUuid(d.lobbyId, "lobby"),
      playerId: assertUuid(d.playerId, "player"),
      playerKey: readKey(d.playerKey),
      round: d.round,
      answer: String(d.answer ?? "").slice(0, 60),
    };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.playerKey);
    const [{ data: lobby }, { data: member }] = await Promise.all([
      db.from("lobbies").select("status, starts_at, words").eq("id", data.lobbyId).maybeSingle(),
      db.from("lobby_players").select("id").eq("lobby_id", data.lobbyId).eq("player_id", data.playerId).maybeSingle(),
    ]);
    if (!lobby || lobby.status !== "playing" || !lobby.starts_at || !member) {
      return { ok: false as const, error: "You're not in this game." };
    }
    const startsAt = new Date(lobby.starts_at).getTime();
    const roundStart = startsAt + data.round * (ROUND_MS + RESULTS_MS);
    const ms = Date.now() - roundStart;
    if (ms < -1_000 || ms > ROUND_MS + 1_500) return { ok: false as const, error: "Time's up for this round." };
    const words = lobby.words as string[];
    const word = words[data.round];
    if (!word) return { ok: false as const, error: "Unknown round." };
    const j = await judgeAnswer(word, data.answer);
    if (!j.ok) return j;
    const { error } = await db.from("answers").insert({
      lobby_id: data.lobbyId,
      player_id: data.playerId,
      round: data.round,
      answer: j.answer,
      tier: j.tier,
      ms: Math.max(0, Math.min(ROUND_MS, ms)),
    });
    if (error) return { ok: false as const, error: "You already answered this round." };
    return { ok: true as const, answer: j.answer, tier: j.tier };
  });

/** Records the final online score, recomputed from stored answers + deterministic bots. */
export const finishOnlineGame = createServerFn({ method: "POST" })
  .inputValidator((d: { lobbyId: string; playerId: string; playerKey: string }) => ({
    lobbyId: assertUuid(d?.lobbyId, "lobby"),
    playerId: assertUuid(d?.playerId, "player"),
    playerKey: readKey(d?.playerKey),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.playerKey);
    const [{ data: lobby }, { data: players }, { data: answers }] = await Promise.all([
      db.from("lobbies").select("*").eq("id", data.lobbyId).maybeSingle(),
      db.from("lobby_players").select("player_id, name").eq("lobby_id", data.lobbyId),
      db.from("answers").select("player_id, round, answer, tier, ms").eq("lobby_id", data.lobbyId),
    ]);
    if (!lobby?.starts_at || !players) return { score: 0 };
    const me = players.find((p) => p.player_id === data.playerId);
    if (!me) return { score: 0 };
    const humans: Player[] = players.map((p) => ({ id: p.player_id, name: p.name, isBot: false }));
    const bots = makeBots(lobby.seed, lobby.bot_count);
    const words = lobby.words as string[];
    const byRound = botAnswersByRound(lobby.seed, bots, words) as Record<string, Answer | null>[];
    for (const a of answers ?? []) if (byRound[a.round]) byRound[a.round]![a.player_id] = { answer: a.answer, tier: a.tier, ms: a.ms };
    const { totals } = scoreGame([...humans, ...bots], byRound);
    const score = totals[data.playerId] ?? 0;
    if (Date.now() >= gameEndsAt(new Date(lobby.starts_at).getTime()) - RESULTS_MS) {
      await db.from("scores").upsert(
        { game_key: `online:${data.lobbyId}:${data.playerId}`, player_id: data.playerId, name: me.name, score, mode: "online" },
        { onConflict: "game_key", ignoreDuplicates: true },
      );
    }
    return { score };
  });

export type LeaderboardRow = { player_id: string; name: string; total: number; games: number; best: number };

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d: { period: "all" | "weekly" | "daily" }) => ({
    period: (["all", "weekly", "daily"].includes(d?.period) ? d.period : "all") as "all" | "weekly" | "daily",
  }))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: rows, error } = await client.rpc("leaderboard", { p_period: data.period });
    if (error) {
      console.error(error);
      return { rows: [] as LeaderboardRow[], error: "Leaderboard is unavailable right now." };
    }
    return {
      rows: (rows ?? []).map((r) => ({ ...r, total: Number(r.total), games: Number(r.games) })) as LeaderboardRow[],
      error: null as string | null,
    };
  });
