# Robin.ai

**Evidence-first meeting intelligence.** Triage inbound founder requests, analyze meeting transcripts, and keep your pipeline honest—with AI detection, signal extraction, and GRUE-style diligence.

---

## What it does

- **Triage** — Founders (or others) go through a short chat. The system scores authenticity and quality, extracts signals, and recommends **meet / refer out / pass**. Harsh, skeptical persona; 5-layer AI detection and behavioral probes.
- **Analyze** — Paste a meeting transcript (e.g. Granola) and optionally your notes (e.g. Wispr). Get an Evidence Map, GRUE diligence checklist, conflict report (transcript vs dictation), and conviction score.
- **Pipeline** — View leads, override decisions, attach Calendly on approval. Optional “your style” memory from overrides.

**BYOK:** You bring your own OpenAI or Anthropic API key; optional Groq for zero-cost analysis. No key is stored on our servers.

---

## Features

| Area | Details |
|------|--------|
| **AI detection** | 5-layer (phrases, structure, length, patterns, cumulative); immediate reject or score cap when AI-polished. |
| **Behavioral probes** | Asymmetric questions to test authenticity; evasion and low-specificity penalties. |
| **Signals** | Traction, credentials, and red flags extracted from the conversation. |
| **Scoring** | Dual-axis: authenticity + quality; bands for do-not-recommend / refer-out / recommend. |
| **Analyze** | Evidence log (verified/unverified), blind spots, conflict report (A/B/C), GRUE verdict, AI polish detector. |

**Product (Phase A):** Sign up / log in (Supabase), Free (5 analyses/month) and Solo ($199/mo, unlimited). Landing at `/`, app at `/app`. Stripe Checkout + webhook for subscriptions.

---

## Quick start

### Prerequisites

- Python 3.8+
- OpenAI API key (or Anthropic `sk-ant-...`, or set `GROQ_API_KEY` for free analysis)

### Run locally

```bash
git clone https://github.com/abhishek5878/vc_voice.git
cd vc_voice
pip install -r requirements.txt
python run_local.py
```

Open **http://localhost:3000**. You’ll get the landing page; open **/app** for the triage + analyze app. Enter your API key and (optional) workspace in the app.

### Optional: auth and billing

To enable sign-up, login, and Stripe:

1. **Supabase** — New project → run `supabase/schema.sql` in SQL Editor. Add env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. **Stripe** — Create a Solo product ($199/mo), add webhook `https://<your-domain>/api/stripe_webhook` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Add env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_SOLO`.

See **docs/SELL_TO_WORLD_PLAN.md** for full Phase A–D plan and env details.

---

## Project structure

```
├── api/                    # Vercel serverless
│   ├── health.py           # Health check
│   ├── intake.py           # Contact intake
│   ├── chat.py             # Triage conversation
│   ├── analyze.py          # Meeting analysis (Evidence Map, GRUE, conflicts)
│   ├── leads.py            # Pipeline + overrides
│   ├── stats.py            # Pipeline stats
│   ├── memory.py           # “Your style” memory
│   ├── config.py           # Calendly, rate limit
│   ├── auth.py             # Sign up / log in (Supabase)
│   ├── me.py               # Current user + workspace
│   ├── create_checkout_session.py
│   └── stripe_webhook.py
├── lib/                    # Core logic
│   ├── ai_detection.py     # 5-layer AI detection
│   ├── behavioral_probes.py
│   ├── signal_extraction.py
│   ├── archetype_similarity.py
│   ├── scoring.py
│   ├── evaluation.py
│   ├── conversation.py
│   ├── contacts_store.py
│   ├── analyze_store.py
│   ├── supabase_client.py  # Auth + workspaces
│   ├── plan_limits.py      # Free 5/mo, Solo unlimited
│   └── config.py
├── supabase/
│   └── schema.sql          # workspaces, profiles, analysis_usage
├── static/
│   ├── index.html          # App (served at /app)
│   ├── landing.html        # Marketing (served at /)
│   ├── auth.html           # Sign up / log in
│   ├── terms.html, privacy.html
│   ├── app.js
│   └── styles.css
├── data/                   # Knowledge base (e.g. VC persona)
├── docs/
│   └── SELL_TO_WORLD_PLAN.md
├── vercel.json
└── requirements.txt
```

---

## Deployment (Vercel)

```bash
vercel
```

Set in Vercel (or `.env`):

- **Required for app:** None (BYOK only).
- **For auth:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **For billing:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_SOLO`; optionally `FRONTEND_URL`.

Routing: `/` → landing, `/app` → app. API under `/api/*`.

---

## API (concise)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Status, BYOK mode |
| POST | `/api/intake` | Record contact, get `conversation_id` |
| POST | `/api/chat` | Triage message (headers: `X-API-Key`, optional `X-Workspace-Id`) |
| POST | `/api/analyze` | Transcript ± dictation → Evidence Map, GRUE, conflicts (402 if over Free limit) |
| GET | `/api/leads` | Pipeline (query: `workspace_id`) |
| GET | `/api/config` | Calendly URL, rate limit days |
| POST | `/api/auth/register` | Sign up (body: email, password, name?) |
| POST | `/api/auth/login` | Log in (body: email, password) |
| GET | `/api/me` | Current user + workspace (header: `Authorization: Bearer <token>`) |

---

## Pricing (product)

- **Free** — 5 analyses/month, unlimited triage, BYOK.
- **Solo** — $199/mo, unlimited analyses.
- **Partner / Fund / Enterprise** — Contact for invoice or PO.

---

## License

Private — not for redistribution.
