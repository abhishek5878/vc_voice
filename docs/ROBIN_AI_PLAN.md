# Robin.ai — Implementation Plan

**Product doc:** `robin_ai_product_document.docx`  
**Current codebase:** PI Triage (Sajith Pai triage bot + universal intake)  
**Goal:** Evolve into Robin.ai — *Cognitive Firewall for High-Bandwidth Leaders* (Skeptical Principal Architecture).

---

## 1. Product doc → Current codebase mapping

| Robin.ai concept | Doc reference | Current implementation |
|------------------|---------------|-------------------------|
| **Skeptical Principal** | Part III – every output anchored to evidence | `app/services/universal_intake.py`: Skeptical Principal prompts, evidence-only signals, counter-questions |
| **Semantic Evidence Logs (SEL)** | Layer 1 – claim + source quote; Unverified if no quote | `_extract_signals_with_evidence()`, `evidence_log` with `evidence`, `verified`; `_skeptical_principal_review()` |
| **GRUE Stress-Test** | Layer 3 – diligence checklist (what was NOT said) | `GRUE_CORE_METRICS`, `blind_spots`, `questions_for_next_meeting` in universal_intake |
| **Conflict Reporter** | Layer 2 – Type A/B (factual, tonal) | `generate_conflict_report()` — transcript vs dictation; Type C (omission) → Phase 2 |
| **Blind spots** | Failure Mode 1 – absence of evidence | `blind_spots` from missing GRUE metrics; surfaced in appraisal |
| **BYOK** | Part III – Bring Your Own Key | API key in header; Groq zero-cost in universal_intake |
| **Pedigree Intelligence** | Part III – network trust (later: cross-fund) | `_check_pedigree()`, `pedigree_knowledge.json` (Indian Mafia, tier-1); single-user today |
| **AI Polish / narrative laundering** | Failure Mode 3 | `lib/ai_detection.py`, behavioral probes, scoring in chat triage |
| **Immediate Appraisal / GRUE verdict** | Evidence Map + verdict | `_build_appraisal_markdown()`, `immediate_appraisal`, `grue_verdict` (High/Medium/Low) |
| **Key claims to verify** | Evidence-anchored follow-up | `key_claims_to_verify`, `claims_verification` in leads/chat |

**Gaps for Phase 1 (Robin.ai Core SPA):**

- **Product naming / positioning:** Robin.ai, “Cognitive Firewall”, “Skeptical Principal” in UI and copy (optional for MVP).
- **Analyze flow in UI:** No current UI for “paste Granola/Wispr → see Evidence Map + GRUE Checklist + Conflict Report”. Chat flow is founder-facing; Analyze is VC-facing (post-meeting).
- **API for Analyze:** Universal intake `distill()` lives under `app/services/` and is only exposed via FastAPI `/{tenant}/intake/bulk` (VoiceVC app). PI Triage on Vercel has no endpoint that calls `distill()`.
- **Granola one-click import:** Doc says “one-click import via API”. MVP: keep manual paste; add Granola API later.
- **Anthropic Claude BYOK:** Currently OpenAI + Groq; add Claude when needed.

---

## 2. Phased implementation

### Phase 1 (0–6 months) — Core SPA in PI Triage

1. **Expose Analyze API (Vercel)**  
   - New serverless handler: `POST /api/analyze`.  
   - Body: `text` (single paste) or `transcript_text` + `dictation_text` (dual for conflict report). Optional `tool_hint`: `granola` \| `wispr`.  
   - Header: `X-API-Key` (BYOK).  
   - Call `app.services.universal_intake.distill()`; return `evidence_log`, `blind_spots`, `questions_for_next_meeting`, `conflict_report`, `immediate_appraisal` (including `immediate_appraisal_markdown`, `grue_verdict`, `pedigree`).

2. **Analyze UI**  
   - New section: “Analyze a meeting”.  
   - Two text areas: “Meeting transcript (e.g. Granola)” and “Your notes / dictation (e.g. Wispr)” (optional).  
   - Submit → call `/api/analyze` with BYOK → render:  
     - **Evidence Map:** verified signals with quotes; unverified with counter-questions.  
     - **GRUE Diligence Checklist:** blind spots + questions for next meeting.  
     - **Conflict Report:** if both transcript and dictation provided (side-by-side discrepancies).  
     - **GRUE Verdict:** High / Medium / Low + short copy.

3. **Navigation**  
   - After API key setup: show both “Start conversation” (existing intake → chat) and “Analyze a meeting” (new flow).  
   - No DB required for Analyze in MVP (stateless).

4. **Copy and branding (light)**  
   - Use “Evidence Map”, “Blind spots”, “GRUE checklist”, “Conflict report” in the Analyze UI.  
   - Optional: add “Robin” or “Skeptical Principal” in title/header later.

### Phase 2 (6–18 months) — Intelligence amplification ✅ Implemented

- **Type C conflicts:** ✅ Omission detection in `generate_conflict_report()` via `_detect_omission_conflicts()` (LLM); `conflict_type: "omission"` in response and UI.
- **AI Polish detector:** ✅ `_run_ai_polish_detection()` in distill; `lib.ai_detection.run_ai_detection` on transcript; `ai_polish` in analyze response and "Narrative authenticity" in UI.
- **Claude BYOK:** ✅ `_get_llm_config` and `_llm_chat` support Anthropic (sk-ant- / ANTHROPIC_API_KEY); Anthropic Messages API.
- **Export:** ✅ Copy markdown + Download .md in Analyze results (buildAnalyzeMarkdown, copyAnalyzeMarkdown, downloadAnalyzeMarkdown).
- **Pedigree Intelligence:** Single-user only (existing). Calendar + Granola/Wispr one-click: deferred (need external APIs).

### Phase 3 (18–36 months) — Network intelligence (partial)

- **Conviction Score:** ✅ In `immediate_appraisal.conviction_score` (0–1) from GRUE verdict + verified count; ✅ GET `/api/conviction?conversation_id=xxx` returns conviction from triage evaluation.
- **Claim consistency / history:** ✅ GET `/api/leads?conversation_id=xxx` returns single lead with `claim_history: { key_claims_to_verify, claims_verification }`.
- Cross-fund Pedigree, Enterprise SSO, SOC 2, GDPR/DPDP: not implemented (org/infra).

---

## 3. File and endpoint changes (Phase 1)

| Action | Item |
|--------|------|
| **Create** | `api/analyze.py` — POST handler, calls `distill()`, returns SPA output. |
| **Update** | `vercel.json` — add rewrite `/api/analyze` → `/api/analyze.py`. |
| **Create/update** | `static/index.html` — “Analyze a meeting” section. |
| **Create/update** | `static/app.js` — analyze form, call `/api/analyze`, render Evidence Map, GRUE checklist, Conflict Report, Verdict. |
| **Create/update** | `static/styles.css` — styles for evidence list, blind spots, conflict rows. |

---

## 4. Dependencies and deployment

- **Analyze API:** Imports `app.services.universal_intake.distill`. Requires `app/` and `data/pedigree_knowledge.json` in deployment. Vercel deploys full repo; `api/*.py` are serverless entry points.  
- **No new Python deps:** `universal_intake` uses `httpx` (already in requirements).  
- **Frontend:** No new libs; vanilla JS/CSS.

---

## 5. Success criteria (Phase 1)

- VC can paste a meeting transcript (and optionally dictation), hit Analyze, and see:  
  - Evidence Map (claims + quotes + verified/unverified).  
  - GRUE Diligence Checklist (blind spots + questions for next meeting).  
  - Conflict Report when two inputs provided.  
  - GRUE Verdict.  
- All processing uses BYOK (OpenAI or Groq).  
- No regressions to existing chat triage or contact intake.

---

*“Don’t believe everything you hear. Believe the evidence.”* — Robin.ai
