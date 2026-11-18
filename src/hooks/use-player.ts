import { useCallback, useEffect, useState } from "react";
import { validatePlayerName } from "@/lib/game/filter";

const ID_KEY = "sr.playerId";
const NAME_KEY = "sr.playerName";

export type LocalPlayer = { id: string; name: string };

/** Anonymous player identity kept on this device. `player` is null until hydrated. */
export function usePlayer() {
  const [player, setPlayer] = useState<LocalPlayer | null>(null);

  useEffect(() => {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    const stored = localStorage.getItem(NAME_KEY) ?? "";
    const name = stored && validatePlayerName(stored).ok ? stored : "";
    setPlayer({ id, name });
  }, []);

  const saveName = useCallback((name: string) => {
    localStorage.setItem(NAME_KEY, name);
    setPlayer((p) => (p ? { ...p, name } : p));
  }, []);

  return { player, saveName };
}
