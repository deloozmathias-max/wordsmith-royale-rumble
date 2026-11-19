CREATE TABLE public.player_keys (
  player_id uuid PRIMARY KEY,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.player_keys TO service_role;
ALTER TABLE public.player_keys ENABLE ROW LEVEL SECURITY;