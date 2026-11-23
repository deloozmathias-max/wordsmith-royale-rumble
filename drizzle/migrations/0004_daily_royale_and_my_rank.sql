CREATE OR REPLACE FUNCTION public.leaderboard_totals(p_period text)
RETURNS TABLE(player_id uuid, name text, total bigint, games bigint, best integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.player_id,
         (array_agg(s.name ORDER BY s.created_at DESC))[1] AS name,
         sum(s.score)::bigint AS total,
         count(*)::bigint AS games,
         max(s.score) AS best
  FROM public.scores s
  WHERE CASE p_period
          WHEN 'daily' THEN s.created_at >= date_trunc('day', now())
          WHEN 'weekly' THEN s.created_at >= date_trunc('week', now())
          WHEN 'royale' THEN s.mode = 'daily'
            AND s.game_key LIKE '%:' || to_char((now() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
          ELSE true
        END
  GROUP BY s.player_id
$$;
REVOKE EXECUTE ON FUNCTION public.leaderboard_totals(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_totals(text) TO service_role;

CREATE OR REPLACE FUNCTION public.leaderboard(p_period text)
RETURNS TABLE(player_id uuid, name text, total bigint, games bigint, best integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.player_id, t.name, t.total, t.games, t.best
  FROM public.leaderboard_totals(p_period) t
  ORDER BY t.total DESC, t.best DESC
  LIMIT 50
$$;
GRANT EXECUTE ON FUNCTION public.leaderboard(text) TO anon, authenticated, service_role;

-- One player's place: rank (ties share a rank), their numbers and how many players are ranked.
CREATE OR REPLACE FUNCTION public.leaderboard_rank(p_period text, p_player uuid)
RETURNS TABLE(rank bigint, total bigint, games bigint, best integer, players bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    SELECT t.player_id, t.total, t.games, t.best,
           rank() OVER (ORDER BY t.total DESC, t.best DESC) AS rank,
           count(*) OVER () AS players
    FROM public.leaderboard_totals(p_period) t
  )
  SELECT r.rank, r.total, r.games, r.best, r.players FROM r WHERE r.player_id = p_player
$$;
GRANT EXECUTE ON FUNCTION public.leaderboard_rank(text, uuid) TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS scores_mode_created_idx ON public.scores(mode, created_at);