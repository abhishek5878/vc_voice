-- VC contact email: founders can email their pitch when at par

ALTER TABLE public.robin_profiles
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.robin_profiles.email IS 'VC email; shown to founders when at par so they can email their profile and evidence.';
