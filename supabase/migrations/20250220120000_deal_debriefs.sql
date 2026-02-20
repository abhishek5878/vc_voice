-- Post-call debrief: transcript + analysis result per deal

CREATE TABLE IF NOT EXISTS public.deal_debriefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  transcript_text text NOT NULL,
  result_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_debriefs_deal_id ON public.deal_debriefs(deal_id);
CREATE INDEX IF NOT EXISTS deal_debriefs_created_at ON public.deal_debriefs(created_at DESC);

ALTER TABLE public.deal_debriefs ENABLE ROW LEVEL SECURITY;

-- VCs can read debriefs for their own deals
DROP POLICY IF EXISTS "Users can read deal_debriefs for own deals" ON public.deal_debriefs;
CREATE POLICY "Users can read deal_debriefs for own deals" ON public.deal_debriefs
  FOR SELECT
  USING (deal_id IN (SELECT id FROM public.deals WHERE user_id = auth.uid()));

-- Inserts/updates only via service role (API with admin client)
-- No INSERT policy for auth users so only backend can create debriefs
