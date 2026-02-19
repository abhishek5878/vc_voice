-- Store emails collected at passcode sign-in (no auth; passcode-only)

CREATE TABLE IF NOT EXISTS public.robin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only server (service role) can insert/read; no anon access
ALTER TABLE public.robin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for robin_emails"
  ON public.robin_emails
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.robin_emails IS 'Emails submitted with passcode; accessed only via API with service role.';
