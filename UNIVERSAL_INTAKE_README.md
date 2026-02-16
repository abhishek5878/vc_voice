# Universal Intake: Zero-Cost Investor OS

Bulletproof handling for Granola notes and Wispr Flow transcripts: **Skeptical Principal** persona, **Evidence** for every signal, **Unverified + Counter-Question**, **Conflict Reporting** (Wispr vs Granola), **Pedigree** tagging (Indian Mafia / IIT–IIM), and **Markdown Immediate Appraisal** (GRUE verdict).

## 1. SemanticDistiller (`app/services/universal_intake.py`)

- **`detect_source_type(text, api_key?)`**  
  Classifies input as **transcript** (meeting), **note** (structured/bullets), or **dictation** (Wispr brain dump). Uses heuristics (timestamps, speaker labels, bullet count, run-on sentences); optional LLM when ambiguous.

- **Granola (transcript)**  
  - Strips meeting noise (fillers, [inaudible], etc.).  
  - Extracts **hard signals** aligned with **GRUE** (Growth, Retention, Unit Economics): Retention, ARR, CAC, LTV, churn, CM2+.  
  - Each signal has an **Evidence Log** (exact transcript quote).  
  - **Skeptical Associate**: vague signals marked **Unverified**; **Questions for Next Meeting** and **blind_spots** (metrics the founder dodged) are generated.

- **Wispr (dictation)**  
  - Reorganizes voice-to-text into a structured **Investment Thesis Fragment** (problem, solution, traction, ask).  
  - Same evidence log, unverified list, blind_spots, and questions.

- **Public API**  
  **`distill(text, api_key=None, persona_name="the VC", tool_hint=None)`**  
  Returns: `source_type`, `tool`, `source_metadata`, `evidence_log`, `unverified_signals`, `blind_spots`, `questions_for_next_meeting`, `immediate_appraisal`. For Wispr also `investment_thesis_fragment`.

## 2. Lead model (`app/models.py`)

- **`source_metadata`** (JSON): `{ "source_type": "transcript"|"note"|"dictation", "tool": "granola"|"wispr"|"note" }`.  
- **`blind_spots`** (JSON array): list of metrics not mentioned (e.g. `["retention", "cac"]`).  

Both are set when bulk intake is run with a `conversation_id` (and optionally when merging bulk into chat).

## 3. API

- **`POST /api/v1/{tenant_slug}/intake/bulk`**  
  Body: `{ "text", "tool_hint?", "conversation_id?", "create_lead_if_missing?" }`.  
  Returns **Immediate Appraisal** (evidence_log, blind_spots, questions_for_next_meeting, immediate_appraisal).  
  If `conversation_id` is provided, updates (or creates) the Lead with `source_metadata` and `blind_spots`.

- **Chat**  
  To return an Immediate Appraisal from the chat endpoint for long pasted text, see **`app/api/v1/endpoints/UNIVERSAL_INTAKE_CHAT_INTEGRATION.md`** (e.g. `?bulk=1` or `bulk: true` in body).

## 4. Registering the router

In your FastAPI app (e.g. `app/main.py`), include the universal intake router:

```python
from app.api.v1.endpoints import universal_intake
app.include_router(universal_intake.router, prefix="/api/v1", tags=["universal_intake"])
```

Ensure the prefix matches your existing v1 routes (e.g. `/api/v1` so that the full path is `/api/v1/{tenant_slug}/intake/bulk`).

## 5. Skeptical Principal & Conflict Reporting

- **Skeptical Principal**: Every verified signal has an **Evidence** (exact transcript quote). Vague/aspirational claims are **Unverified** with a **Counter-Question** (e.g. "What is the exact D90 retention?"). Optional LLM pass tightens evidence and counter-questions.
- **Conflict Reporter**: When both **transcript_text** (Granola) and **dictation_text** (Wispr) are provided, the API runs both pipelines and compares metrics. If the meeting transcript says one value and the post-meeting dictation another, a **ConflictReport** entry is added (metric, transcript_value, dictation_value, summary). Stored on **Lead.conflict_report**.

## 6. Pedigree & Markdown Appraisal

- **data/pedigree_knowledge.json** seeds Indian Mafia (top 50 startups) and tier-1 colleges (IIT/IIM, BITS, NIT, ISB, etc.). The engine tags leads with **high_pedigree** and a **pedigree_multiplier** (e.g. 1.15) used in the GRUE verdict.
- **Immediate Appraisal** returns a clean **Markdown** block:
  - **The Hook** (narrative summary)
  - **Verified Signals (with Evidence Quotes)**
  - **Blind Spots & Conflicts** (risk identification)
  - **Sajith-Framework Recommendation (GRUE verdict)** — High / Medium / Low + rationale.

## 7. Zero-Cost Configuration (Groq / Llama 3)

The system **defaults to Groq (Llama 3)** for all semantic processing when **`GROQ_API_KEY`** is set. This keeps operational cost at zero (Groq free tier). If `GROQ_API_KEY` is not set, the tenant’s **OpenAI API key** is used when provided.

- Set `GROQ_API_KEY` in the environment (get a key at [console.groq.com](https://console.groq.com)).
- Model used: `llama-3.1-8b-instant` (fast, free tier).
- All LLM calls in universal intake (source detection, Skeptical Principal review, thesis reorganization) use `_llm_chat()`, which prefers Groq when available.

## 8. GRUE / India VC reference

Signal patterns follow **`lib/signal_extraction.py`** and **GRUE** (Growth, Retention, Unit Economics): retention, ARR/MRR, CAC, LTV, churn, LTV:CAC, path to CM2+, and traction (customers, users).
