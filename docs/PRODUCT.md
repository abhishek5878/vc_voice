# Robin.ai — Product Overview

**Tagline:** Your calendar, filtered.

Robin.ai is a multi-mode analysis and triage product for **solo GPs and small-fund partners**. It screens inbound founder requests, stress-tests meeting transcripts, and prepares attack briefs for upcoming calls—so the VC gets a pipeline, evidence-backed recommendations, and one place to override. Built for people who don’t have a team to filter for them.

---

## 1. What Robin Does

- **Two moments:** (1) **Request → Triage** — inbound wants a meeting; Robin runs a skeptical conversation and recommends meet / refer / pass. (2) **Meeting done → Stress-test** — you have a transcript (and optional private notes); Robin extracts claims, finds conflicts, runs a GRUE-style checklist, and builds an interrogation so you see what held up and what didn’t before the next call.
- **Founder-facing:** Founders can **stress-test their pitch** before the real meeting: paste a deck or one-liner, get interrogated by a blunt VC-style bot, and tighten the pitch.
- **Your bar, not a generic chatbot:** Robin uses your thesis and config (harshness, turn count, rejection message). Output is evidence-anchored: claims tied to source quotes, verified/unverified/contradicted tags.

---

## 2. The Three Modes

| Mode | Name | Best for | What you do | What you get |
|------|------|----------|-------------|--------------|
| **1** | Post-Meeting | Just had a call — stress-test what was said | Paste meeting transcript + optional private notes | Evidence map (claims + source quotes), conflict report (transcript vs notes), GRUE coverage & blind spots, conviction interrogation (red list, yellow list, pedigree flags) |
| **2** | Pre-Meeting Prep | Call tomorrow — get your question list ready | Paste or upload pitch deck / memo | **Pre-Meeting Attack Brief** (red list “probe hard”, yellow list, recommended sequence), plus full evidence map, GRUE, and interrogation |
| **3** | Pitch Stress-Test | Founder prepping — harden the pitch before the meeting | Paste pitch material (or founder does) | Same pipeline as Mode 2, then **live chat** with a blunt VC persona that stress-tests the deck and pushes for concrete rewrites |

- **Mode 1 & 2:** Run → progress steps (extracting claims, cross-referencing, GRUE, interrogation) → **Report** (markdown, copy, download, add to calendar, email, duplicate run).
- **Mode 3:** Run → **Founder Chat** (no static report). VC persona: “Short answers, real numbers, no fluff”; asks for 1–2 sentence summary and then systematically tears down the deck.

---

## 3. User Flows

### VC / operator

1. Open **Robin** (landing → “Open Robin” or `/app`).
2. Choose mode: **Post-Meeting**, **Pre-Meeting Prep**, or **Pitch Stress-Test** (or land directly via `/app?mode=1`, `/app?mode=2`, `/app?mode=3`).
3. **Input screen:**  
   - Paste **Public Transcript** (meeting transcript or shared context).  
   - Optionally **Private Dictation** (private notes).  
   - For Mode 2/3: **Pitch Material** (deck narrative, PDF, DOCX, or URL from Google Docs / Notion / Medium / Substack, etc.).  
   - Optional **Session context:** Meeting title, Company / founder, Calendar event link (e.g. Calendly).  
   - **AI (BYOK):** Provider (OpenAI, Anthropic, Groq) and API key (session-only; we don’t store it).
4. **Run Robin** → Progress (“Usually 30–60 sec”) → **Report** (Mode 1/2) or **Founder Chat** (Mode 3).
5. From report: **Copy for calendar**, **Google Calendar**, **Outlook**, **Copy for Slack**, **Email brief**, **Copy markdown**, **Download .md**, **Back to input** (prefills last run), **Duplicate this run**.

### Founder

1. Land on **For founders** (e.g. `/app?mode=3` or link from VC).
2. Paste deck or one-liner; optionally use “Fetch from URL” or upload PDF/DOCX.
3. Run → **Founder Chat** with the VC-style interrogator.
4. Optionally use “Copy link for another founder” to share the stress-test URL.

---

## 4. Core Features (Current)

### Input & ingestion

- **Three streams:** Public Transcript, Private Dictation, Pitch Material (each: paste, paste from clipboard, file upload .txt / .md / .pdf / .docx).
- **Fetch from URL:** Supported origins (HTTPS): Google Docs, Notion, GitHub, Medium, Substack, etc. Fetches and strips HTML to text; user chooses “→ Pitch Material” or “→ Public Transcript”.
- **Session context (sticky):** Meeting title, Company/founder, Calendar event link. Stored in `localStorage` and reused; “We remember meeting title and company for next time.”
- **Run summary:** Before Run, line shows what will be used: e.g. “Transcript 2,340 chars · Pitch 1,100 chars · Meeting: Partner call – Acme”.
- **Validation:** Min 200 characters total; inline “add X more (min 200)”. If input is enough but API key missing: “Almost there — add your API key in the panel on the right.”

### After a run

- **Last run saved:** Every successful run (report or Mode 3 chat) is saved as “last run”. **Back to input** and **Duplicate this run** both return to the input screen with last run prefilled (no lost work).
- **Duplicate last run:** On input, if a last run exists, “Duplicate last run →” prefills all fields from it.

### Report actions (Mode 1 & 2)

- **Copy for calendar** — Copies brief text (red/yellow list, etc.) to paste into any calendar event.
- **Google Calendar** — Opens Google Calendar with new event: title = meeting + company (or “Robin.ai prep”), description = brief.
- **Outlook** — Same for Outlook on the web (subject + body prefilled).
- **Copy for Slack** — Short summary: meeting/company, “Robin Post-meeting” or “Pre-meeting brief”, up to 3 red-list bullets.
- **Email brief** — Opens mailto with subject (meeting/company) and body = full report (markdown, truncated for URL length).
- **Copy markdown** / **Download .md** — Full report in markdown (Notion-ready).

### “Use with your tools” (on report)

- Short section explaining: Calendar (buttons or paste), Email (add recipient), Slack/Notion (Copy for Slack vs Copy markdown), and **bookmarks:** `/app?mode=1`, `/app?mode=2`, `/app?mode=3`.

### Mode 3 (Founder)

- **Send link to founder** — On input (mode 3): “Send link to founder (copy stress-test URL)” copies `/app?mode=3`. In Founder Chat: “Copy link for another founder” does the same.
- **VC persona:** Blunt, skeptical, short answers and real numbers; opening message sets expectations and asks for 1–2 sentence company summary and session goal.

---

## 5. Integrations (Current)

- **Calendar:** Copy for calendar; one-click **Google Calendar** and **Outlook** with event prefilled. Optional calendar event link in session context (e.g. Calendly).
- **Email:** Mailto with subject and body (full report).
- **Slack:** “Copy for Slack” = short summary for pasting in a channel or DM.
- **Notion:** “Copy markdown” is Notion-ready; paste into a doc.
- **Bookmarks:** `/app?mode=1` (post-call), `/app?mode=2` (prep), `/app?mode=3` (founder stress-test). Promoted on landing and in Mode Select (“Tip: bookmark /app?mode=2 for prep, /app?mode=1 for post-call”).
- **Fetch from URL:** Pull content from Google Docs, Notion, Medium, Substack, GitHub, etc., into Pitch Material or Public Transcript.

No server-side CRM, Slack webhooks, or Zapier yet—all current integrations are copy/open URL/mailto in the browser.

---

## 6. Landing & Navigation

- **Landing:** Hero (“Screen inbound requests. Stress-test meetings. One workflow.”), **Two moments** (Meeting request / Post-meeting), **For founders** (3-step: paste → interrogated → tighten; CTA “Start stress-test →”), **What you get**, **Integrate with your stack** (Calendar, Email & Slack, Bookmark and go), **Why not ChatGPT**, **Pricing**, footer (Open Robin, Sign up, Terms, Privacy).
- **Nav:** Robin.ai, “For founders” → `/app?mode=3`, “Open Robin” → `/app`, “Sign in” → `/auth`.
- **Auth:** Supabase (email + password); sign up / log in; redirect to `/app` on success.

---

## 7. Pricing (as on landing)

| Plan | Price | Includes |
|------|--------|----------|
| Free | $0 | 5 stress-tests/month, unlimited triage, BYOK |
| Solo | $199/mo | Unlimited stress-tests, BYOK, Calendly, pipeline |
| Partner / Fund | Custom | Contact for invoice or PO |

---

## 8. Technical Summary

- **Frontend:** Next.js 14 (App Router), React, Tailwind. Dark theme (zinc/amber). Pages: `/` (landing), `/app` (mode select → input → progress → report or chat), `/auth` (Supabase sign in/up).
- **Backend (API routes):** `/api/analyze` (pipeline), `/api/llm` (chat), `/api/ingest`, `/api/parse-pdf`, `/api/fetch-url`. BYOK: API key in `Authorization: Bearer` or session; OpenAI, Anthropic, Groq.
- **Pipeline:** 4 layers (evidence extraction, cross-stream conflict, GRUE coverage, conviction interrogation); Mode 2 adds Pre-Meeting Attack Brief. See `docs/ROBIN_SKEPTICAL_PRINCIPAL_SPEC.md` and `docs/ROBIN_DOC_IMPLEMENTATION_CHECKLIST.md` for spec and checklist.
- **Data:** Session metadata and “last run” in `localStorage`. Supabase: auth; schema includes `robin_sessions` (meeting_title, company_name, calendar_event_url), founders, claims_log, pedigree_flags (for future pipeline/CRM use).

---

## 9. How to Use It Day to Day

- **Post-call:** Bookmark `/app?mode=1`. Paste transcript (+ optional notes), add meeting/company if you like, Run → report → Copy for calendar / Google Calendar / Outlook / Email or Slack as needed. Back to input keeps last run prefilled for the next meeting.
- **Pre-call:** Bookmark `/app?mode=2`. Paste or fetch deck, Run → attack brief first → same export and calendar options.
- **Founders:** Share `/app?mode=3` or “Send link to founder”. They paste deck, run, then chat with the VC bot. You can use the same flow yourself to stress-test a deck silently before a partner meeting.

---

*This document describes the product as implemented in the current codebase. For pipeline and architecture detail, see `docs/ROBIN_SKEPTICAL_PRINCIPAL_SPEC.md` and `docs/ROBIN_DOC_IMPLEMENTATION_CHECKLIST.md`.*
