# Robin.ai / PI Triage — Loopholes & Stickiness (VC Lens)

A VC would ask: *Where can this break? Where’s the hook that makes it sticky and drives product-led growth?*

---

## Part 1: Loopholes (Risks & Gaps)

### 1. **No VC identity → no “my product”**

- **Today:** One shared link, one global `contacts.json`. No login, no “my pipeline,” no “my analyses.”
- **Risk:** Any VC can use the same instance; there’s no account to retain. They can copy the workflow into a spreadsheet and churn.
- **Loophole:** You don’t know *who* is using the product, so you can’t measure retention or expansion per VC/fund.

### 2. **Founder can probe and game**

- **Today:** Founder gets the triage link, does intake (name, email, current_work), then chat. Nothing stops them from:
  - Trying again with a different email to see what passes.
  - Sharing the link so others “practice” pitching.
- **Risk:** Pipeline noise; “recommend meeting” loses meaning if many conversations are synthetic.
- **Loophole:** No rate limit per email/domain, no fingerprinting, no “this email already triaged.”

### 3. **Analyze is stateless → no habit**

- **Today:** Paste transcript → get Evidence Map / GRUE / Conflicts → copy or download. No history, no “my last 10 analyses.”
- **Risk:** VC uses it once per meeting, then forgets. No reason to return except “I have another transcript.”
- **Loophole:** No saved analyses, no search, no “continue where you left off.”

### 4. **Override doesn’t feed back**

- **Today:** VC can override (approve/reject) via leads API; result is stored on the contact. No model or threshold update.
- **Risk:** Product doesn’t get better for that VC. They keep overriding the same way; no learning loop.
- **Loophole:** Override + reason could tune strictness or prompt per VC; today it’s dead data.

### 5. **No “next step” in the loop**

- **Today:** Evaluation says “Recommended for Meeting” and “Schedule 15m intro” in text only. No Calendly (or other) link, no “Add to pipeline,” no CRM.
- **Risk:** Friction between “recommend” and “meeting booked.” VC does the last mile elsewhere; Robin stays optional.
- **Loophole:** One-click “Schedule intro” (e.g. Calendly URL per VC) would tie the product to the outcome.

### 6. **BYOK hides usage**

- **Today:** LLM calls use the VC’s (or org’s) API key. You don’t see usage.
- **Risk:** You can’t show “You ran 47 analyses this month” or “Your pipeline had 12 triages.” No usage-based stickiness or upsell.
- **Loophole:** Optional telemetry (count of analyses/triages per user, no content) would enable usage insights and expansion.

### 7. **Single global data store**

- **Today:** `contacts.json` is one file. No per-VC or per-fund isolation.
- **Risk:** No “your deal flow” vs “another fund’s.” No multi-tenant stickiness; harder to sell “fund-wide” later.
- **Loophole:** Even lightweight identity (e.g. link token or stored “VC slug”) would allow partitioning and “my pipeline” later.

### 8. **No internal viral loop**

- **Today:** VC shares link with founders. No “invite your associate” or “share this analysis with your partner.”
- **Risk:** Usage stays single-user. No team/fund adoption, no expansion revenue.
- **Loophole:** “Add teammate” or “Share analysis” would create internal PLG (one partner brings the fund).

---

## Part 2: Stickiness & Product-Led Growth

### High impact (do first)

| Lever | What to add | Why it’s sticky / PLG |
|-------|----------------|------------------------|
| **VC dashboard** | “Your pipeline” UI: list leads, scores, overrides, claim history. | Switching cost: history lives in Robin; leaving = losing the list. |
| **Analyze history** | Save analyses per (identified) user; “Recent analyses” + search. | Habit: “I always run my meeting through Robin” and “I can find that call from last week.” |
| **Post-evaluation CTA** | On “Recommend meeting”: Calendly (or configurable) link + “Add to pipeline.” | Closes the loop: recommendation → meeting booked in one place; product = path to outcome. |
| **Lightweight identity** | Optional: “Name this workspace” or link token (e.g. `?v=xyz`) so all usage is scoped. | Enables “my pipeline,” “my analyses,” and later team/fund. |

### Medium impact (next)

| Lever | What to add | Why it’s sticky / PLG |
|-------|----------------|------------------------|
| **Override → learning** | Use override + reason to suggest threshold/prompt tweaks or “You often approve when X.” | Product gets better for them; lock-in through personalization. |
| **Weekly digest** | Email or in-app: “12 triage conversations, 3 recommended; top 2 for review.” | Brings them back; builds “check Robin” habit. |
| **Shareable triage link** | `voicevc.com/sajith` (or `/v/xyz`); founder sees “Triage by Sajith / Blume.” | Brand + one place for all inbound; VC shares link → more usage. |
| **Export to their stack** | Notion / Airtable / Affinity: “Save to Notion” or “Add to Affinity.” | Integration = part of their workflow; harder to drop. |

### Network / expansion

| Lever | What to add | Why it’s sticky / PLG |
|-------|----------------|------------------------|
| **Team / fund tier** | “Invite associate”; shared pipeline or Evidence Vault. | One partner brings the fund; expansion revenue. |
| **Usage visibility** | “Analyses this month” / “Triage count” (no content), even with BYOK. | Enables usage-based value story and upsell. |

---

## Part 3: Loophole Fixes (Concrete) — Implemented

1. **Founder gaming:** Rate limit by email or domain (e.g. 1 triage per email per 7 days); optional “this email already completed triage” message.
2. **No next step:** VC (or org) config: “Calendly URL” (or “Meeting link”); show it on “Recommend meeting” + “Schedule intro” button.
3. **Override = dead data:** Store override + reason; later: “Suggest stricter/looser” or “Your overrides often approve when [signal].”
4. **No identity:** Optional “Workspace name” or stable link token; persist in `localStorage` or cookie; scope contacts and analyses to that token (server-side or client-side keying).

---

## Summary

- **Biggest loopholes:** No VC identity, no pipeline/dashboard, no post-recommendation action (Calendly), founder gaming, stateless Analyze, override not feeding back.
- **Biggest stickiness/PLG levers:** VC dashboard (“your pipeline”), Analyze history, Calendly (or equivalent) on recommend, lightweight identity, then override learning and weekly digest.

Fixing the loopholes (identity, anti-gaming, next-step CTA) and adding the first stickiness levers (dashboard, analyze history, meeting link) would materially improve retention and set up product-led growth.
