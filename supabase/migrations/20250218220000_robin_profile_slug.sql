-- Add public slug for per-VC pitch URLs

ALTER TABLE public.robin_profiles
  ADD COLUMN IF NOT EXISTS slug text UNIQUE;

