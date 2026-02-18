-- Scoring engine + future-ready aggregation schema

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS vertical text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS share_public boolean DEFAULT false;

ALTER TABLE public.deal_runs ADD COLUMN IF NOT EXISTS resistance_score float;
ALTER TABLE public.deal_runs ADD COLUMN IF NOT EXISTS deal_strength float;

CREATE INDEX IF NOT EXISTS deals_outcome ON public.deals(outcome) WHERE outcome IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.aggregated_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  vertical text,
  stage text,
  avg_value float NOT NULL,
  std_dev float,
  sample_size int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aggregated_patterns_metric_vertical_stage ON public.aggregated_patterns(metric_name, vertical, stage);

CREATE TABLE IF NOT EXISTS public.outcome_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_name text NOT NULL,
  success_rate float NOT NULL,
  failure_rate float NOT NULL,
  sample_size int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.claim_taxonomy_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_type text NOT NULL,
  avg_verification_rate float NOT NULL,
  sample_size int NOT NULL DEFAULT 0
);

ALTER TABLE public.aggregated_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_taxonomy_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only aggregated_patterns" ON public.aggregated_patterns;
CREATE POLICY "Service role only aggregated_patterns" ON public.aggregated_patterns FOR ALL USING (false);

DROP POLICY IF EXISTS "Service role only outcome_correlations" ON public.outcome_correlations;
CREATE POLICY "Service role only outcome_correlations" ON public.outcome_correlations FOR ALL USING (false);

DROP POLICY IF EXISTS "Service role only claim_taxonomy_counts" ON public.claim_taxonomy_counts;
CREATE POLICY "Service role only claim_taxonomy_counts" ON public.claim_taxonomy_counts FOR ALL USING (false);
