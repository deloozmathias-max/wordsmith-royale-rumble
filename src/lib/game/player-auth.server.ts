// Server-only: proves a request comes from the player it claims to be.
// Each player holds a random secret key; only its SHA-256 hash is stored.
type Admin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

const KEY_RE = /^[0-9a-f]{64}$/;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createPlayerKey(db: Admin) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const playerId = crypto.randomUUID();
  const { error } = await db.from("player_keys").insert({ player_id: playerId, key_hash: await sha256(key) });
  if (error) {
    console.error(error);
    throw new Error("Could not create a player right now.");
  }
  return { playerId, key };
}

/** Throws unless `key` is the secret issued for `playerId`. */
export async function assertPlayer(db: Admin, playerId: string, key: unknown): Promise<void> {
  if (typeof key !== "string" || !KEY_RE.test(key)) throw new Error("Unauthorized");
  const { data } = await db.from("player_keys").select("key_hash").eq("player_id", playerId).maybeSingle();
  if (!data || data.key_hash !== (await sha256(key))) throw new Error("Unauthorized");
}
