// Stand-in for game.functions in the static (GitHub Pages / iframe) build, which has no
// server. Every call rejects, so the app falls back to offline mode.
export type { LeaderboardRow, LobbyAnswer } from "./game.functions";

const offline = async (): Promise<never> => {
  throw new Error("Offline build: no game server");
};

export const registerPlayer = offline;
export const getServerTime = offline;
export const judgeSynonym = offline;
export const submitBotsGame = offline;
export const joinMatchmaking = offline;
export const leaveLobby = offline;
export const startLobby = offline;
export const submitOnlineAnswer = offline;
export const finishOnlineGame = offline;
export const getLeaderboard = offline;
export const getLobbyState = offline;
