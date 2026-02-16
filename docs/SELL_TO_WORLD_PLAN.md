# Robin.ai — Sell to the World: Implementation Plan

**Goal:** Turn Robin.ai from single-user / BYOK-only into a sellable product with sign-up, billing, teams, and global trust.

**Order:** Phase A → B → C → D. Each phase is shippable on its own.

---

## Phase A — "We can take money" (Week 1–2)

**Outcome:** Anyone can sign up, see pricing, pay for Solo, and use the app with plan limits enforced.

| # | Task | Decisions | Files / Components |
|---|------|-----------|--------------------|
| A1 | **Auth (sign-up + login)** | Email + password; JWT returned; no magic link in MVP. | **Backend:** `api/auth.py` (register, login); verify JWT in protected routes. **Storage:** Supabase Auth (no password storage in our DB) + `public.profiles` (display_name, default_workspace_id). **Frontend:** `static/auth.html` or inline in index: sign-up form, login form; store token in localStorage; send `Authorization: Bearer <token>` on API calls. |
| A2 | **Workspace ↔ User** | One workspace per user at signup; workspace_id = identity for pipeline/analyses. | **DB:** `public.workspaces` (id, name, owner_id, plan, stripe_customer_id, stripe_subscription_id, created_at). On register: create user in Supabase Auth, create row in workspaces, set owner_id = auth.uid(). **Frontend:** After login, set workspace from API or from token payload. |
| A3 | **Stripe: products + checkout** | One paid plan: Solo $199/mo; Free tier with limits (e.g. 5 analyses/month). | **Backend:** `api/create_checkout_session.py` (POST, creates Stripe Checkout session, return url); `api/stripe_webhook.py` (customer.subscription.*, invoice.* → update workspaces.plan). **Env:** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_SOLO. **Dashboard:** Create product/price in Stripe; optional Customer Portal for cancel/upgrade. |
| A4 | **Plan limits** | Free: 5 analyses/month, unlimited triage (or cap later). Solo: unlimited. | **Backend:** `lib/plan_limits.py` (get_plan_for_workspace, check_analysis_limit); call before `/api/analyze` and optionally before triage. **DB:** plan on workspace (free | solo | partner | fund). |
| A5 | **Landing + pricing page** | Public marketing page at `/` or `/landing`; app at `/app` or keep `/` as app and add `/landing`. | **Static:** `static/landing.html` (hero, value prop, pricing table, CTA → Sign up / Log in). **Routing:** vercel.json: `/` → landing, `/app` → static/index.html (current app). Or: `/` = app, `/landing` = landing (simpler, no redirect for existing users). **Pricing:** Free (0), Solo ($199/mo), optional Partner/Fund (Contact us). |
| A6 | **ToS + Privacy Policy** | Static pages; link from footer and sign-up. | **Static:** `static/terms.html`, `static/privacy.html` (placeholder content; replace with legal review). Links in landing + auth forms. |

**Tech choices (Phase A):**
- **Auth & DB:** Supabase (Auth + Postgres). Alternatives: Auth0 + Vercel Postgres / Turso if you prefer.
- **Stripe:** Checkout Session for first-time payment; webhook for subscription lifecycle.
- **JWT:** Supabase returns JWT; verify in API using SUPABASE_JWT_SECRET or Supabase client.

**Dependencies:** `supabase` (Python), `stripe` (Python). Add to requirements.txt.

---

## Phase B — "Funds can buy" (Week 2–3)

**Outcome:** Workspace = team; invite by email; roles (Admin / Member); invoice path for Fund/Enterprise.

| # | Task | Decisions | Files / Components |
|---|------|-----------|--------------------|
| B1 | **Workspace = team** | One workspace can have many members; pipeline and (optionally) analyses shared. | **DB:** `workspace_members` (workspace_id, user_id, role: admin \| member, invited_at). **API:** GET/POST invite by email (send invite link or add existing user). **Frontend:** Settings → Invite; list members. |
| B2 | **Roles** | Admin: edit workspace, billing, invite/remove. Member: use pipeline, run analyses. | **Backend:** Middleware or helper: require_admin for billing/invite; require_member for analyze/leads. |
| B3 | **Invoice / PO path** | Fund and Enterprise: "Contact us" or Stripe Invoicing. | **Frontend:** Pricing: "Fund / Enterprise — Contact us for invoice or PO." **Backend:** Optional `api/request_invoice.py` (capture email + company, send to you or create Stripe customer without subscription). |

---

## Phase C — "Global and trustworthy" (Week 3–4)

**Outcome:** BYOK + optional hosted LLM; compliance one-pager; email (transactional + optional digest); currency/invoicing for INR/EUR.

| # | Task | Decisions | Files / Components |
|---|------|-----------|--------------------|
| C1 | **BYOK + "Use Robin's API"** | Keep X-API-Key; add optional plan: "Use Robin's API" (we call OpenAI/Claude on your behalf, usage metered or included in Solo). | **Backend:** If no X-API-Key and workspace has "use_robin_api": true, use server-side key; track usage per workspace. **Config:** Workspace or plan flag. |
| C2 | **Compliance one-pager** | Single page: data handling, retention, no training on your data, SOC 2 roadmap. | **Static:** `static/compliance.html` or `/compliance`; link from footer and sales. |
| C3 | **Email** | Transactional: welcome, password reset (Supabase handles reset). Optional: digest (weekly summary of pipeline). | **Tool:** Supabase Auth email templates or Resend/SendGrid for custom transactional; optional cron + digest. |
| C4 | **Currency + invoicing** | INR/EUR if needed; Stripe supports multiple currencies; invoice for Enterprise. | **Stripe:** Add INR/EUR prices or separate products; invoice via Stripe Invoicing for "Contact us" deals. |

---

## Phase D — "Scale and retain" (Week 4+)

**Outcome:** Better onboarding, shared Evidence Vault, mobile-friendly, clear errors.

| # | Task | Decisions | Files / Components |
|---|------|-----------|--------------------|
| D1 | **First-run onboarding** | After signup: short wizard (add API key or "Use Robin's API", optional Calendly, tour of Pipeline). | **Frontend:** Post-login redirect to onboarding flow (steps in app or modal). |
| D2 | **Shared Evidence Vault** | Fund-level: saved analyses or evidence snippets shared across workspace. | **DB:** evidence_vault or shared_analyses table (workspace_id, created_by, content, meeting_ref). **API:** CRUD for vault; **UI:** Section in app to view/share. |
| D3 | **Mobile-responsive + errors** | Polish layout; clear error messages (auth, limit exceeded, payment failed). | **Frontend:** CSS breakpoints; error states in forms and API response handling. |

---

## Implementation order (Phase A)

1. **Supabase setup** — Create project; enable Auth (email); create tables: `workspaces`, `profiles` (if needed). RLS: users see only their workspaces.
2. **api/auth.py** — POST /api/auth/register, POST /api/auth/login (call Supabase Auth); return JWT + workspace_id.
3. **api/me.py** — GET /api/me (verify JWT, return user + workspace + plan); used by frontend to restore session.
4. **Protect existing APIs** — Optional: require Bearer for /api/analyze, /api/leads, etc.; or allow anonymous with workspace_id and enforce limits by workspace.
5. **Stripe** — create_checkout_session.py, stripe_webhook.py; env vars; plan limits in lib/plan_limits.py.
6. **Frontend** — landing.html, terms.html, privacy.html; auth UI (sign-up/login); send Authorization header; redirect to /app when logged in.
7. **vercel.json** — Add routes for /api/auth/*, /api/me, /api/create_checkout_session, /api/stripe_webhook; optionally / → landing, /app → index.html.

---

## File summary (Phase A new/changed)

| File | Action |
|------|--------|
| docs/SELL_TO_WORLD_PLAN.md | Created (this doc) |
| api/auth.py | New: register, login |
| api/me.py | New: current user + workspace |
| api/create_checkout_session.py | New: Stripe Checkout |
| api/stripe_webhook.py | New: subscription events |
| lib/plan_limits.py | New: get_plan, check_analysis_limit |
| lib/supabase_client.py | New: Supabase client (server-side) |
| static/landing.html | New: marketing + pricing |
| static/terms.html | New: ToS |
| static/privacy.html | New: Privacy Policy |
| static/auth.html | New (or inline): sign-up, login |
| static/app.js, index.html | Extend: auth header, optional /app entry, plan limit handling |
| vercel.json | Add auth + Stripe routes; optional landing rewrite |
| requirements.txt | Add supabase, stripe |

---

## Environment variables (Phase A)

- `SUPABASE_URL` — Supabase project URL  
- `SUPABASE_ANON_KEY` — Public anon key (used to verify user JWT in `/api/me` and protected routes)  
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side (auth admin, DB); do not expose to client  
- `STRIPE_SECRET_KEY`  
- `STRIPE_WEBHOOK_SECRET` — For webhook signature verification  
- `STRIPE_PRICE_ID_SOLO` — Price ID for Solo monthly  
- (Optional) `FRONTEND_URL` — For Stripe redirect URLs (e.g. `https://your-app.vercel.app`)  

Keep existing: `OPENAI_API_KEY`, `CALENDLY_URL`, `GROQ_API_KEY`, etc.

## Phase A one-time setup

1. **Supabase:** Create a project at supabase.com. In SQL Editor, run `supabase/schema.sql`. Copy URL, anon key, and service_role key into env.
2. **Stripe:** Create a product “Solo” with a $199/mo recurring price. Copy price ID to `STRIPE_PRICE_ID_SOLO`. Create a webhook endpoint pointing to `https://your-domain/api/stripe_webhook` and select `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`; copy signing secret to `STRIPE_WEBHOOK_SECRET`.
3. **Routing:** `/` serves the landing page; `/app` serves the app. After login, users are redirected to `/app`.
