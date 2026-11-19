<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Game logic lives in `src/lib/game/` as pure, deterministic modules (engine, words, filter, rng) shared by client and server; bots and word picks derive from a lobby seed so every client and the server compute identical results without storing bot answers.
- All database writes go through server functions using the admin client; public tables only expose SELECT to anon, so scores cannot be forged from the browser.
- Final scores are recomputed on the server (stored answers + seeded bots) before being written to `scores`; never trust a client-sent total.
- Matchmaking and lobby start are atomic SQL functions (advisory lock); any client may call start once the wait time passes, it is idempotent.
- Synonym quality: curated tiers first, then cached `judgments`, then the Datamuse API; cache only real results so ratings stay consistent across players.
- Player identity: the server issues each player an id plus a secret key (only its hash is stored in `player_keys`); every online server function that acts for a player must call `assertPlayer` before using the caller-supplied player id.
