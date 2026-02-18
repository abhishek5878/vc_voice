-- Robin.ai — Pedigree & session storage
-- Run in Supabase SQL Editor. Enable pg_trgm for fuzzy founder match:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Founders (deduplicated by name/company for pedigree)
CREATE TABLE IF NOT EXISTS public.founders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  linkedin_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS founders_name_lower ON public.founders(lower(name));
CREATE INDEX IF NOT EXISTS founders_company ON public.founders(company);
-- Optional fuzzy match: run "CREATE EXTENSION IF NOT EXISTS pg_trgm;" then:
-- CREATE INDEX founders_name_trgm ON public.founders USING gin (name gin_trgm_ops);

-- Sessions: one per analysis or Mode 3 run
CREATE TABLE IF NOT EXISTS public.robin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_id uuid REFERENCES public.founders(id) ON DELETE SET NULL,
  mode int NOT NULL CHECK (mode IN (1, 2, 3)),
  created_at timestamptz NOT NULL DEFAULT now(),
  pipeline_output jsonb,
  conviction_score int CHECK (conviction_score IS NULL OR (conviction_score >= 1 AND conviction_score <= 10)),
  meeting_title text,
  company_name text,
  calendar_event_url text
);

CREATE INDEX IF NOT EXISTS robin_sessions_user_id ON public.robin_sessions(user_id);
CREATE INDEX IF NOT EXISTS robin_sessions_founder_id ON public.robin_sessions(founder_id);
CREATE INDEX IF NOT EXISTS robin_sessions_created_at ON public.robin_sessions(created_at DESC);

-- Claims log: per-session claims for pedigree comparison
CREATE TABLE IF NOT EXISTS public.claims_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.robin_sessions(id) ON DELETE CASCADE,
  founder_id uuid NOT NULL REFERENCES public.founders(id) ON DELETE CASCADE,
  claim text NOT NULL,
  source_quote text,
  status text,
  category text,
  metric text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claims_log_founder_id ON public.claims_log(founder_id);
CREATE INDEX IF NOT EXISTS claims_log_session_id ON public.claims_log(session_id);

-- Pedigree flags: contradictions across sessions for same founder
CREATE TABLE IF NOT EXISTS public.pedigree_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL REFERENCES public.founders(id) ON DELETE CASCADE,
  flagged_by_session uuid NOT NULL REFERENCES public.robin_sessions(id) ON DELETE CASCADE,
  claim_session_a uuid REFERENCES public.robin_sessions(id) ON DELETE SET NULL,
  claim_session_b uuid REFERENCES public.robin_sessions(id) ON DELETE SET NULL,
  severity text CHECK (severity IN ('low', 'medium', 'high')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pedigree_flags_founder_id ON public.pedigree_flags(founder_id);

-- RLS
ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.robin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedigree_flags ENABLE ROW LEVEL SECURITY;

-- Users see only their own sessions (and related founders/claims via session ownership)
DROP POLICY IF EXISTS "Users can CRUD own sessions" ON public.robin_sessions;
CREATE POLICY "Users can CRUD own sessions"
  ON public.robin_sessions FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read founders referenced by own sessions" ON public.founders;
CREATE POLICY "Users can read founders referenced by own sessions"
  ON public.founders FOR SELECT
  USING (
    id IN (SELECT founder_id FROM public.robin_sessions WHERE user_id = auth.uid())
    OR id IN (SELECT founder_id FROM public.claims_log WHERE session_id IN (SELECT id FROM public.robin_sessions WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert founders" ON public.founders;
CREATE POLICY "Users can insert founders"
  ON public.founders FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read claims for own sessions" ON public.claims_log;
CREATE POLICY "Users can read claims for own sessions"
  ON public.claims_log FOR SELECT
  USING (session_id IN (SELECT id FROM public.robin_sessions WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert claims for own sessions" ON public.claims_log;
CREATE POLICY "Users can insert claims for own sessions"
  ON public.claims_log FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM public.robin_sessions WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can read pedigree flags for own sessions" ON public.pedigree_flags;
CREATE POLICY "Users can read pedigree flags for own sessions"
  ON public.pedigree_flags FOR SELECT
  USING (flagged_by_session IN (SELECT id FROM public.robin_sessions WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert pedigree flags for own sessions" ON public.pedigree_flags;
CREATE POLICY "Users can insert pedigree flags for own sessions"
  ON public.pedigree_flags FOR INSERT
  WITH CHECK (flagged_by_session IN (SELECT id FROM public.robin_sessions WHERE user_id = auth.uid()));

-- Trigger: updated_at on founders
CREATE OR REPLACE FUNCTION public.set_founders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS founders_updated_at ON public.founders;
CREATE TRIGGER founders_updated_at
  BEFORE UPDATE ON public.founders
  FOR EACH ROW EXECUTE FUNCTION public.set_founders_updated_at();
