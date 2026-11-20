// Static build for GitHub Pages, iframes and game portals: `bun run build:static`.
// Output in dist-static/ (index.html at its root, relative asset paths, hash URLs).
// There's no game server in this build, so it runs in offline mode (vs Bots + local scores).
// The main vite.config.ts stays as is: the Lovable preview and hosting need it.
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const offlineServer: Plugin = {
  name: "offline-game-functions",
  enforce: "pre",
  resolveId(source) {
    if (/(^|\/)game\.functions(\.ts)?$/.test(source)) return here("./src/lib/game/game.functions.static.ts");
    return null;
  },
};

export default defineConfig({
  root: here("./spa"),
  base: "./",
  mode: "static",
  envDir: here("."),
  publicDir: here("./public"),
  plugins: [offlineServer, tailwindcss(), react()],
  resolve: { alias: { "@": here("./src") } },
  build: { outDir: here("./dist-static"), emptyOutDir: true },
});
