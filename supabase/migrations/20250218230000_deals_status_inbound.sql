-- Allow inbound pitch submissions from public pitch page

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_status_check;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_status_check
  CHECK (status IN ('new', 'meeting', 'diligence', 'invested', 'passed', 'inbound'));
