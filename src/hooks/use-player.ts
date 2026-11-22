import { useCallback, useEffect, useState } from "react";
import { validatePlayerName } from "@/lib/game/filter";
import { claimNameSafe, registerPlayerSafe } from "@/lib/game/api";
import { safeStorage } from "@/lib/safe-storage";

const ID_KEY = "sr.playerId";
const SECRET_KEY = "sr.playerKey";
const NAME_KEY = "sr.playerName";
const OFFLINE_ID_KEY = "sr.offlineId";

/** `offline` is true when the game server couldn't be reached: only vs Bots works then. */
export type LocalPlayer = { id: string; key: string; name: string; offline: boolean };

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
  }
}

/**
 * Anonymous player identity kept on this device. The server issues the id together
 * with a secret key that proves ownership; without a server the player gets a local id.
 * `player` is null until ready.
 */
export function usePlayer() {
  const [player, setPlayer] = useState<LocalPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = safeStorage.get(NAME_KEY) ?? "";
    const name = stored && validatePlayerName(stored).ok ? stored : "";
    const id = safeStorage.get(ID_KEY);
    const key = safeStorage.get(SECRET_KEY);
    if (id && key) {
      setPlayer({ id, key, name, offline: false });
      // Marks the player online and keeps their unique name; if it expired and was
      // taken, the server hands back the new name.
      if (name)
        void claimNameSafe({ playerId: id, key }, name).then((r) => {
          if (!cancelled && r && r.name !== name) {
            safeStorage.set(NAME_KEY, r.name);
            setPlayer((p) => (p ? { ...p, name: r.name } : p));
          }
        });
      return;
    }
    void registerPlayerSafe().then((r) => {
      if (cancelled) return;
      if (r) {
        safeStorage.set(ID_KEY, r.playerId);
        safeStorage.set(SECRET_KEY, r.key);
        setPlayer({ id: r.playerId, key: r.key, name, offline: false });
        return;
      }
      let offlineId = safeStorage.get(OFFLINE_ID_KEY);
      if (!offlineId) {
        offlineId = randomId();
        safeStorage.set(OFFLINE_ID_KEY, offlineId);
      }
      setPlayer({ id: offlineId, key: "", name, offline: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Saves the name; resolves to an error message when another player already has it. */
  const saveName = useCallback(
    async (name: string): Promise<string | null> => {
      if (player && !player.offline && player.key) {
        const r = await claimNameSafe({ playerId: player.id, key: player.key }, name);
        if (r && !r.ok) return "That name is already taken — try another.";
      }
      safeStorage.set(NAME_KEY, name);
      setPlayer((p) => (p ? { ...p, name } : p));
      return null;
    },
    [player],
  );

  return { player, saveName };
}
