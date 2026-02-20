-- Display name for investor (used in pitch page, chat header, etc.)

ALTER TABLE public.robin_profiles
  ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.robin_profiles.display_name IS 'Investor display name (e.g. Priya Mehta) for pitch page and chat.';
