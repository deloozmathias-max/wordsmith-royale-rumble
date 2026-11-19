import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { validatePlayerName } from "@/lib/game/filter";
import { registerPlayer } from "@/lib/game/game.functions";

const ID_KEY = "sr.playerId";
const SECRET_KEY = "sr.playerKey";
const NAME_KEY = "sr.playerName";

export type LocalPlayer = { id: string; key: string; name: string };

/**
 * Anonymous player identity kept on this device. The server issues the id together
 * with a secret key that proves ownership. `player` is null until ready.
 */
export function usePlayer() {
  const [player, setPlayer] = useState<LocalPlayer | null>(null);
  const register = useServerFn(registerPlayer);

  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem(NAME_KEY) ?? "";
    const name = stored && validatePlayerName(stored).ok ? stored : "";
    const id = localStorage.getItem(ID_KEY);
    const key = localStorage.getItem(SECRET_KEY);
    if (id && key) {
      setPlayer({ id, key, name });
      return;
    }
    register()
      .then((r) => {
        localStorage.setItem(ID_KEY, r.playerId);
        localStorage.setItem(SECRET_KEY, r.key);
        if (!cancelled) setPlayer({ id: r.playerId, key: r.key, name });
      })
      .catch((e) => console.error("Could not register player", e));
    return () => {
      cancelled = true;
    };
  }, [register]);

  const saveName = useCallback((name: string) => {
    localStorage.setItem(NAME_KEY, name);
    setPlayer((p) => (p ? { ...p, name } : p));
  }, []);

  return { player, saveName };
}
