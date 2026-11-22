CREATE TABLE public.player_profiles (
  player_id uuid PRIMARY KEY,
  name text NOT NULL,
  name_key text NOT NULL UNIQUE,
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.player_profiles TO service_role;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.friendships (
  player_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, friend_id)
);
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Claims p_name for p_player (also marks them online). Names whose owner has been
-- offline 7+ days are released: that owner gets a default name, friendships stay.
CREATE OR REPLACE FUNCTION public.claim_name(p_player uuid, p_name text)
RETURNS TABLE(name text, ok boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k text := lower(p_name);
  fallback text := 'Player' || substr(md5(p_player::text), 1, 6);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('claim_name'));
  UPDATE player_profiles p
     SET name = 'Player' || substr(md5(p.player_id::text), 1, 6),
         name_key = lower('Player' || substr(md5(p.player_id::text), 1, 6))
   WHERE p.name_key = k AND p.player_id <> p_player AND p.last_seen < now() - interval '7 days';
  IF EXISTS (SELECT 1 FROM player_profiles p WHERE p.name_key = k AND p.player_id <> p_player) THEN
    INSERT INTO player_profiles(player_id, name, name_key) VALUES (p_player, fallback, lower(fallback))
      ON CONFLICT (player_id) DO UPDATE SET last_seen = now();
    RETURN QUERY SELECT p.name, false FROM player_profiles p WHERE p.player_id = p_player;
    RETURN;
  END IF;
  INSERT INTO player_profiles(player_id, name, name_key) VALUES (p_player, p_name, k)
    ON CONFLICT (player_id) DO UPDATE SET name = p_name, name_key = k, last_seen = now();
  RETURN QUERY SELECT p_name, true;
END $$;
REVOKE ALL ON FUNCTION public.claim_name(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_name(uuid, text) TO service_role;