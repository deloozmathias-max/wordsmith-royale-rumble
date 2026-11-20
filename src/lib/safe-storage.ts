// localStorage that never throws: sandboxed iframes, private mode or blocked
// third-party storage fall back to an in-memory map for this session.
const memory = new Map<string, string>();
let usable: boolean | null = null;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  if (usable === false) return null;
  try {
    const s = window.localStorage;
    if (usable === null) {
      s.setItem("__sr_probe", "1");
      s.removeItem("__sr_probe");
      usable = true;
    }
    return s;
  } catch {
    usable = false;
    return null;
  }
}

export const safeStorage = {
  get(key: string): string | null {
    try {
      const s = storage();
      const v = s?.getItem(key) ?? null;
      if (v !== null) return v;
    } catch {
      /* fall through to memory */
    }
    return memory.get(key) ?? null;
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      storage()?.setItem(key, value);
    } catch {
      /* quota or blocked: memory copy is enough */
    }
  },
  remove(key: string): void {
    memory.delete(key);
    try {
      storage()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = safeStorage.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    safeStorage.set(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
