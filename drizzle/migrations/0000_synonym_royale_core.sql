CREATE TABLE public.lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'waiting',
  seed integer NOT NULL,
  words jsonb NOT NULL DEFAULT '[]'::jsonb,
  bot_count integer NOT NULL DEFAULT 0,
  fill_at timestamptz NOT NULL,
  starts_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lobbies TO anon, authenticated;
GRANT ALL ON public.lobbies TO service_role;
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lobbies are public" ON public.lobbies FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.lobby_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lobby_id, player_id)
);
CREATE INDEX lobby_players_lobby_idx ON public.lobby_players(lobby_id);
GRANT SELECT ON public.lobby_players TO anon, authenticated;
GRANT ALL ON public.lobby_players TO service_role;
ALTER TABLE public.lobby_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lobby players are public" ON public.lobby_players FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  round integer NOT NULL,
  answer text NOT NULL,
  tier integer NOT NULL DEFAULT 0,
  ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lobby_id, player_id, round)
);
CREATE INDEX answers_lobby_idx ON public.answers(lobby_id);
GRANT SELECT ON public.answers TO anon, authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Answers are public" ON public.answers FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.judgments (
  word text NOT NULL,
  answer text NOT NULL,
  tier integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (word, answer)
);
GRANT ALL ON public.judgments TO service_role;
ALTER TABLE public.judgments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key text NOT NULL UNIQUE,
  player_id uuid NOT NULL,
  name text NOT NULL,
  score integer NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scores_created_idx ON public.scores(created_at);
CREATE INDEX scores_player_idx ON public.scores(player_id);
GRANT SELECT ON public.scores TO anon, authenticated;
GRANT ALL ON public.scores TO service_role;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scores are public" ON public.scores FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.leaderboard(p_period text)
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
          ELSE true
        END
  GROUP BY s.player_id
  ORDER BY total DESC, best DESC
  LIMIT 50
$$;
GRANT EXECUTE ON FUNCTION public.leaderboard(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.join_matchmaking(p_player_id uuid, p_name text, p_seed integer, p_words jsonb, p_wait_seconds integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lobby uuid;
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(7340021);

  -- Already waiting in a lobby? Rejoin it.
  SELECT lp.lobby_id INTO v_lobby
  FROM public.lobby_players lp JOIN public.lobbies l ON l.id = lp.lobby_id
  WHERE lp.player_id = p_player_id AND l.status = 'waiting'
  ORDER BY lp.joined_at DESC LIMIT 1;
  IF v_lobby IS NOT NULL THEN
    RETURN v_lobby;
  END IF;

  SELECT l.id INTO v_lobby
  FROM public.lobbies l
  WHERE l.status = 'waiting'
    AND l.fill_at > now() + interval '2 seconds'
    AND (SELECT count(*) FROM public.lobby_players lp WHERE lp.lobby_id = l.id) < 10
  ORDER BY l.created_at ASC
  LIMIT 1;

  IF v_lobby IS NULL THEN
    INSERT INTO public.lobbies (seed, words, fill_at)
    VALUES (p_seed, p_words, now() + make_interval(secs => p_wait_seconds))
    RETURNING id INTO v_lobby;
  END IF;

  INSERT INTO public.lobby_players (lobby_id, player_id, name)
  VALUES (v_lobby, p_player_id, p_name)
  ON CONFLICT (lobby_id, player_id) DO NOTHING;

  SELECT count(*) INTO v_count FROM public.lobby_players WHERE lobby_id = v_lobby;
  IF v_count >= 10 THEN
    UPDATE public.lobbies
    SET status = 'playing', starts_at = now() + interval '5 seconds', bot_count = 0
    WHERE id = v_lobby AND status = 'waiting';
  END IF;

  RETURN v_lobby;
END;
$$;
REVOKE ALL ON FUNCTION public.join_matchmaking(uuid, text, integer, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_matchmaking(uuid, text, integer, jsonb, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.start_lobby(p_lobby uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(7340021);
  SELECT count(*) INTO v_count FROM public.lobby_players WHERE lobby_id = p_lobby;
  UPDATE public.lobbies
  SET status = 'playing',
      starts_at = now() + interval '5 seconds',
      bot_count = GREATEST(0, 10 - v_count)
  WHERE id = p_lobby AND status = 'waiting' AND fill_at <= now() + interval '1 second';
END;
$$;
REVOKE ALL ON FUNCTION public.start_lobby(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_lobby(uuid) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;