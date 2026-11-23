import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { judgeAnswer } from "./judge.server";
import { sanitizePlayerName } from "./filter";
import { assertPlayer, createPlayerKey } from "./player-auth.server";
import { LEADERBOARD_PERIODS, dailySeed, isAcceptedDailyKey, type LeaderboardPeriod } from "./daily";
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
  .inputValidator((d: { playerId: string; name: string; seed: number; answers: (string | null)[]; ms: (number | null)[]; dailyKey?: string }) => {
    assertUuid(d?.playerId, "player");
    if (!Number.isInteger(d.seed)) throw new Error("Invalid seed");
    const dailyKey = typeof d.dailyKey === "string" ? d.dailyKey.slice(0, 10) : null;
    if (dailyKey && (!isAcceptedDailyKey(dailyKey) || dailySeed(dailyKey) !== d.seed)) throw new Error("This Daily Royale is over.");
    if (!Array.isArray(d.answers) || d.answers.length !== ROUNDS) throw new Error("Invalid answers");
    return {
      playerId: d.playerId,
      name: String(d.name ?? "").slice(0, 32),
      seed: d.seed,
      answers: d.answers.map((a) => (typeof a === "string" ? a.slice(0, 40) : null)),
      ms: d.ms.map((m) => (typeof m === "number" ? Math.max(0, Math.min(ROUND_MS, Math.round(m))) : 0)),
      dailyKey,
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
    // Daily Royale: only the player's first game of the day counts.
    const gameKey = data.dailyKey ? `daily:${data.playerId}:${data.dailyKey}` : `bots:${data.playerId}:${data.seed}`;
    if (data.dailyKey) {
      const { data: prev } = await db.from("scores").select("score").eq("game_key", gameKey).maybeSingle();
      if (prev) return { score, counted: false };
    }
    await db.from("scores").upsert(
      { game_key: gameKey, player_id: data.playerId, name: you.name, score, mode: data.dailyKey ? "daily" : "bots" },
      { onConflict: "game_key", ignoreDuplicates: true },
    );
    return { score, counted: true };
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

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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
}

function readPeriod(v: unknown): LeaderboardPeriod {
  return LEADERBOARD_PERIODS.includes(v as LeaderboardPeriod) ? (v as LeaderboardPeriod) : "all";
}

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d: { period: LeaderboardPeriod }) => ({ period: readPeriod(d?.period) }))
  .handler(async ({ data }) => {
    let rows: Database["public"]["Functions"]["leaderboard"]["Returns"] | null = null;
    let error: unknown = null;
    try {
      ({ data: rows, error } = await publicClient().rpc("leaderboard", { p_period: data.period }));
    } catch (e) {
      error = e;
    }
    if (error) {
      console.error(error);
      return { rows: [] as LeaderboardRow[], error: "Leaderboard is unavailable right now." };
    }
    return {
      rows: (rows ?? []).map((r) => ({ ...r, total: Number(r.total), games: Number(r.games) })) as LeaderboardRow[],
      error: null as string | null,
    };
  });

export type MyRank = { rank: number; total: number; games: number; best: number; players: number };

/** One player's place in a leaderboard, however far down they are. Null when they have no score there. */
export const getMyRank = createServerFn({ method: "GET" })
  .inputValidator((d: { period: LeaderboardPeriod; playerId: string }) => ({
    period: readPeriod(d?.period),
    playerId: assertUuid(d?.playerId, "player"),
  }))
  .handler(async ({ data }): Promise<MyRank | null> => {
    const { data: rows, error } = await publicClient().rpc("leaderboard_rank", { p_period: data.period, p_player: data.playerId });
    if (error) throw new Error("Rank unavailable");
    const r = rows?.[0];
    if (!r) return null;
    return { rank: Number(r.rank), total: Number(r.total), games: Number(r.games), best: r.best, players: Number(r.players) };
  });

export type LobbyAnswer = { player_id: string; round: number; answer: string; tier: number; ms: number };

/**
 * Lobby state for a verified member of that lobby. Other players' answers for a round
 * that is still open are masked so nobody can copy them before the round ends.
 */
export const getLobbyState = createServerFn({ method: "POST" })
  .inputValidator((d: { lobbyId: string; playerId: string; playerKey: string }) => ({
    lobbyId: assertUuid(d?.lobbyId, "lobby"),
    playerId: assertUuid(d?.playerId, "player"),
    playerKey: readKey(d?.playerKey),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.playerKey);
    const [{ data: lobby }, { data: players }, { data: answers }] = await Promise.all([
      db
        .from("lobbies")
        .select("id, status, seed, words, bot_count, fill_at, starts_at")
        .eq("id", data.lobbyId)
        .maybeSingle(),
      db.from("lobby_players").select("player_id, name, joined_at").eq("lobby_id", data.lobbyId).order("joined_at"),
      db.from("answers").select("player_id, round, answer, tier, ms").eq("lobby_id", data.lobbyId),
    ]);
    if (!lobby || !players?.some((p) => p.player_id === data.playerId)) throw new Error("Lobby not found");
    const startsAt = lobby.starts_at ? new Date(lobby.starts_at).getTime() : null;
    const now = Date.now();
    const visible: LobbyAnswer[] = (answers ?? []).map((a) => {
      const roundClosesAt = startsAt === null ? Infinity : startsAt + a.round * (ROUND_MS + RESULTS_MS) + ROUND_MS;
      if (a.player_id === data.playerId || now >= roundClosesAt) return a;
      return { player_id: a.player_id, round: a.round, answer: "", tier: 0, ms: a.ms };
    });
    return { lobby, players, answers: visible };
  });

// ---- Friends & unique names -------------------------------------------------

export type FriendRow = { id: string; name: string; lastSeen: string };
type Auth = { playerId: string; key: string };

function readAuth(d: { playerId?: unknown; key?: unknown }): Auth {
  return { playerId: assertUuid(d?.playerId, "player"), key: readKey(d?.key) };
}

/** Claims a unique name (and marks the player online). Returns the name the player now has. */
export const claimName = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { name: string }) => ({ ...readAuth(d), name: sanitizePlayerName(String(d?.name ?? "")) }))
  .handler(async ({ data }) => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.key);
    const { data: rows, error } = await db.rpc("claim_name", { p_player: data.playerId, p_name: data.name });
    const row = rows?.[0];
    if (error || !row) throw new Error("Could not save your name right now.");
    return { name: row.name, ok: row.ok };
  });

/** Finds players by (the start of) their current name. */
export const searchPlayers = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { query: string }) => ({
    ...readAuth(d),
    query: String(d?.query ?? "").replace(/[^a-z0-9 _-]/gi, "").trim().slice(0, 16).toLowerCase(),
  }))
  .handler(async ({ data }): Promise<FriendRow[]> => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.key);
    if (data.query.length < 2) return [];
    const { data: rows } = await db
      .from("player_profiles")
      .select("player_id, name, last_seen")
      .like("name_key", `${data.query}%`)
      .neq("player_id", data.playerId)
      .order("last_seen", { ascending: false })
      .limit(10);
    return (rows ?? []).map((r) => ({ id: r.player_id, name: r.name, lastSeen: r.last_seen }));
  });

/** Lists the caller's friends with their current names (friends are linked by id, so renames keep them). */
export const listFriends = createServerFn({ method: "POST" })
  .inputValidator((d: Auth) => readAuth(d))
  .handler(async ({ data }): Promise<FriendRow[]> => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.key);
    const { data: links } = await db.from("friendships").select("friend_id").eq("player_id", data.playerId);
    const ids = (links ?? []).map((l) => l.friend_id);
    if (!ids.length) return [];
    const { data: rows } = await db.from("player_profiles").select("player_id, name, last_seen").in("player_id", ids);
    return (rows ?? [])
      .map((r) => ({ id: r.player_id, name: r.name, lastSeen: r.last_seen }))
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  });

export const setFriend = createServerFn({ method: "POST" })
  .inputValidator((d: Auth & { friendId: string; add: boolean }) => ({
    ...readAuth(d),
    friendId: assertUuid(d?.friendId, "friend"),
    add: d?.add === true,
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    await assertPlayer(db, data.playerId, data.key);
    if (data.friendId === data.playerId) throw new Error("You can't add yourself.");
    if (data.add) {
      const { data: exists } = await db.from("player_profiles").select("player_id").eq("player_id", data.friendId).maybeSingle();
      if (!exists) throw new Error("Player not found.");
      await db.from("friendships").upsert({ player_id: data.playerId, friend_id: data.friendId });
    } else {
      await db.from("friendships").delete().eq("player_id", data.playerId).eq("friend_id", data.friendId);
    }
    return { ok: true };
  });
