// Entry for the static build (GitHub Pages, iframes, game portals). Uses hash-based URLs
// (#/play/bots) so any static host can serve it from any folder without rewrites.
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { HeadContent, RouterProvider, createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Route as RootRoute } from "./routes/__root";

// The normal shell renders <html>/<body>; here the page already exists, so only add head tags.
function SpaShell({ children }: { children: ReactNode }) {
  return (
    <>
      <HeadContent />
      {children}
    </>
  );
}
// Drop the root-absolute favicon link: index.html already has a relative one that works in subfolders.
const rootHead = RootRoute.options.head;
RootRoute.update({
  shellComponent: SpaShell,
  head: async (ctx: never) => {
    const h = (await rootHead?.(ctx)) ?? {};
    return { ...h, links: (h.links ?? []).filter((l) => l?.rel !== "icon") };
  },
} as never);

const queryClient = new QueryClient();
const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

const el = document.getElementById("root");
if (el) createRoot(el).render(<RouterProvider router={router} />);
