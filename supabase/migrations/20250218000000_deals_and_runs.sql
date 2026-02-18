-- Phase 1: Persistent Deal Memory
-- deals, deal_runs, founder_claims

CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  vertical text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'meeting', 'diligence', 'invested', 'passed')),
  conviction_score float,
  outcome text CHECK (outcome IS NULL OR outcome IN ('invested', 'declined', 'failed', '3x', '10x', 'zombie')),
  share_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deals_user_id ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS deals_updated_at ON public.deals(updated_at DESC);
CREATE INDEX IF NOT EXISTS deals_company_user ON public.deals(user_id, lower(trim(company_name)));

CREATE TABLE IF NOT EXISTS public.deal_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  mode int NOT NULL CHECK (mode IN (1, 2, 3)),
  report_json jsonb,
  red_flags jsonb NOT NULL DEFAULT '[]',
  yellow_flags jsonb NOT NULL DEFAULT '[]',
  claims jsonb NOT NULL DEFAULT '[]',
  grue_scores jsonb,
  risk_score float,
  clarity_score float,
  interrogation_resistance float,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_runs_deal_id ON public.deal_runs(deal_id);
CREATE INDEX IF NOT EXISTS deal_runs_created_at ON public.deal_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.founder_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.deal_runs(id) ON DELETE SET NULL,
  claim_text text NOT NULL,
  source_quote text,
  status text NOT NULL CHECK (status IN ('verified', 'unverified', 'contradicted', 'changed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS founder_claims_deal_id ON public.founder_claims(deal_id);
CREATE INDEX IF NOT EXISTS founder_claims_created_at ON public.founder_claims(created_at DESC);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own deals" ON public.deals;
CREATE POLICY "Users can CRUD own deals" ON public.deals FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read deal_runs for own deals" ON public.deal_runs;
CREATE POLICY "Users can read deal_runs for own deals" ON public.deal_runs FOR SELECT
  USING (deal_id IN (SELECT id FROM public.deals WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert deal_runs for own deals" ON public.deal_runs;
CREATE POLICY "Users can insert deal_runs for own deals" ON public.deal_runs FOR INSERT
  WITH CHECK (deal_id IN (SELECT id FROM public.deals WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can read founder_claims for own deals" ON public.founder_claims;
CREATE POLICY "Users can read founder_claims for own deals" ON public.founder_claims FOR SELECT
  USING (deal_id IN (SELECT id FROM public.deals WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert founder_claims for own deals" ON public.founder_claims;
CREATE POLICY "Users can insert founder_claims for own deals" ON public.founder_claims FOR INSERT
  WITH CHECK (deal_id IN (SELECT id FROM public.deals WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.set_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_updated_at ON public.deals;
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_deals_updated_at();

-- Public snapshot: allow unauthenticated read when share_public = true
DROP POLICY IF EXISTS "Public read shared deals" ON public.deals;
CREATE POLICY "Public read shared deals" ON public.deals FOR SELECT
  USING (share_public = true);
