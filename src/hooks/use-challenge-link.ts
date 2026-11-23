import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ChallengeSearch } from "@/lib/game/challenge";

/**
 * Absolute link to the challenge page. Goes through the router's history, so it is
 * `/challenge?…` on the hosted site and `…/index.html#/challenge?…` in the static build.
 */
export function useChallengeLink() {
  const router = useRouter();
  return useCallback(
    (search: ChallengeSearch) => {
      const loc = router.buildLocation({ to: "/challenge", search });
      return new URL(router.history.createHref(loc.href), window.location.href).toString();
    },
    [router],
  );
}

/** Absolute link to today's Daily Royale (path or hash URL, like useChallengeLink). */
export function useDailyLink() {
  const router = useRouter();
  return useCallback(() => {
    const loc = router.buildLocation({ to: "/play/daily" });
    return new URL(router.history.createHref(loc.href), window.location.href).toString();
  }, [router]);
}
