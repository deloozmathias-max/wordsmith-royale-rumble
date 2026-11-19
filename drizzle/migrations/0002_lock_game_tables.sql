DROP POLICY IF EXISTS "Lobbies are public" ON public.lobbies;
DROP POLICY IF EXISTS "Lobby players are public" ON public.lobby_players;
DROP POLICY IF EXISTS "Answers are public" ON public.answers;
DROP POLICY IF EXISTS "Scores are public" ON public.scores;

REVOKE ALL ON public.lobbies, public.lobby_players, public.answers, public.scores FROM anon, authenticated;
GRANT ALL ON public.lobbies, public.lobby_players, public.answers, public.scores TO service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lobbies','lobby_players','answers'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;