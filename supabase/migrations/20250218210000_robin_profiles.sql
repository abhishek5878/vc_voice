-- Per-user Robin voice profiles (links + extracted voice)

CREATE TABLE IF NOT EXISTS public.robin_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio text,
  tone text,
  decision_style text,
  twitter_url text,
  linkedin_url text,
  substack_url text,
  blog_url text,
  podcast_url text,
  extra_urls jsonb,
  voice_profile jsonb,
  last_scraped_at timestamptz,
  scrape_status text,
  scrape_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.robin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own robin_profiles" ON public.robin_profiles;
CREATE POLICY "Users can CRUD own robin_profiles"
  ON public.robin_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_robin_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS robin_profiles_updated_at ON public.robin_profiles;
CREATE TRIGGER robin_profiles_updated_at
  BEFORE UPDATE ON public.robin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_robin_profiles_updated_at();

