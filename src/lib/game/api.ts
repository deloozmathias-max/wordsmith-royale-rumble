// Every call to the game server goes through here. If the server or database can't be
// reached, the call resolves to an offline result instead of throwing.
import {
  claimName,
  getLeaderboard,
  getMyRank,
  listFriends,
  searchPlayers,
  setFriend,
  judgeSynonym,
  registerPlayer,
  submitBotsGame,
  type LeaderboardRow,
} from "@/lib/game/game.functions";
import type { LeaderboardPeriod } from "./daily";
import { judgeOffline } from "./offline";
import type { Judgment } from "./judge-core";

/** True in the static GitHub Pages / iframe build, which has no game server. */
export const OFFLINE_ONLY = import.meta.env.MODE === "static";

export async function tryServer<T>(call: () => Promise<T>): Promise<T | null> {
  if (OFFLINE_ONLY) return null;
  try {
    return await call();
  } catch (e) {
    console.warn("Game server unreachable, using offline mode.", e);
    return null;
  }
}

export function registerPlayerSafe() {
  return tryServer(() => registerPlayer());
}

export async function judgeSafe(word: string, answer: string): Promise<Judgment> {
  const r = await tryServer(() => judgeSynonym({ data: { word, answer } }));
  return r ?? judgeOffline(word, answer);
}

export function submitBotsGameSafe(data: {
  playerId: string;
  playerKey: string;
  name: string;
  seed: number;
  answers: (string | null)[];
  ms: (number | null)[];
  dailyKey?: string;
}) {
  return tryServer(() => submitBotsGame({ data }));
}

export type LeaderboardResult = { rows: LeaderboardRow[]; error: string | null; offline: boolean };

/** Online leaderboard, or an empty offline result (the page then shows this device's scores). */
export async function leaderboardSafe(period: LeaderboardPeriod): Promise<LeaderboardResult> {
  const r = await tryServer(() => getLeaderboard({ data: { period } }));
  if (!r || r.error) return { rows: [], error: null, offline: true };
  return { rows: r.rows, error: null, offline: false };
}

type Auth = { playerId: string; key: string };

/** Claims a unique name; null when offline (the local name is then kept as-is). */
export function claimNameSafe(auth: Auth, name: string) {
  return tryServer(() => claimName({ data: { ...auth, name } }));
}
export function searchPlayersSafe(auth: Auth, query: string) {
  return tryServer(() => searchPlayers({ data: { ...auth, query } }));
}
export function listFriendsSafe(auth: Auth) {
  return tryServer(() => listFriends({ data: auth }));
}
export function setFriendSafe(auth: Auth, friendId: string, add: boolean) {
  return tryServer(() => setFriend({ data: { ...auth, friendId, add } }));
}

/** Your place in a leaderboard (null when offline or unranked). */
export function myRankSafe(period: LeaderboardPeriod, playerId: string) {
  return tryServer(() => getMyRank({ data: { period, playerId } }));
}
