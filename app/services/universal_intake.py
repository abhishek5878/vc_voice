"""
Universal Intake: Granola notes & Wispr Flow transcripts.
Zero-Cost Investor OS: Skeptical Principal persona, Evidence for every signal,
Unverified + Counter-Question, Conflict Reporting (Wispr vs Granola), Pedigree tagging,
and Markdown Immediate Appraisal (GRUE verdict).
"""

import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

# Zero-Cost default: Groq/Llama 3 for semantic processing when GROQ_API_KEY is set
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-3.5-turbo"
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
LLM_TIMEOUT = 30
LLM_MAX_RETRIES = 2

# GRUE core metrics (Sajith): any missing metric MUST become a Question for Next Meeting
GRUE_CORE_METRICS = ["retention", "arr", "mrr", "revenue", "cac", "ltv", "ltv_cac", "churn", "growth", "customers", "users"]


def _run_ai_polish_detection(text: str) -> Optional[Dict[str, Any]]:
    """Run AI polish / narrative authenticity detection on transcript. Returns None if lib not available."""
    try:
        from lib.ai_detection import run_ai_detection
        return run_ai_detection(text or "", previous_cumulative=0.0)
    except Exception:
        return None


def _get_llm_config(openai_api_key: Optional[str] = None) -> Tuple[Optional[str], str, str]:
    """Zero-Cost: Prefer Groq when GROQ_API_KEY set; else Anthropic (sk-ant-); else OpenAI. Returns (api_key, url, model)."""
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key:
        return groq_key, GROQ_API_URL, GROQ_MODEL
    key = (openai_api_key or os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    if key.startswith("sk-ant-"):
        return key, ANTHROPIC_API_URL, ANTHROPIC_MODEL
    if key.startswith("sk-"):
        return key, OPENAI_API_URL, OPENAI_MODEL
    return None, OPENAI_API_URL, OPENAI_MODEL


def _llm_chat(
    messages: List[Dict[str, str]],
    openai_api_key: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 600,
) -> str:
    """Single LLM call: Groq, OpenAI, or Anthropic (BYOK)."""
    key, url, model = _get_llm_config(openai_api_key)
    if not key:
        raise ValueError("No LLM API key: set GROQ_API_KEY, or pass OpenAI (sk-) / Anthropic (sk-ant-) api_key")

    # Anthropic Messages API (different request/response shape)
    if "api.anthropic.com" in url:
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in messages],
        }
        if temperature is not None:
            payload["temperature"] = temperature
        headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
        with httpx.Client(timeout=LLM_TIMEOUT) as client:
            for attempt in range(LLM_MAX_RETRIES + 1):
                try:
                    r = client.post(url, json=payload, headers=headers)
                    r.raise_for_status()
                    data = r.json()
                    content = data.get("content") or []
                    if isinstance(content, list) and content and isinstance(content[0], dict):
                        return (content[0].get("text") or "").strip()
                    return ""
                except (httpx.TimeoutException, httpx.HTTPStatusError):
                    if attempt == LLM_MAX_RETRIES:
                        raise
        raise RuntimeError("Anthropic LLM request failed")

    # OpenAI-compatible (OpenAI, Groq)
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    with httpx.Client(timeout=LLM_TIMEOUT) as client:
        for attempt in range(LLM_MAX_RETRIES + 1):
            try:
                r = client.post(url, json=payload, headers=headers)
                r.raise_for_status()
                return (r.json().get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
            except (httpx.TimeoutException, httpx.HTTPStatusError):
                if attempt == LLM_MAX_RETRIES:
                    raise
    raise RuntimeError("LLM request failed")


# GRUE-focused patterns (India VC): Retention, ARR, CAC, LTV, churn, CM2+
# Evidence = exact substring from text for each match
EVIDENCE_SIGNAL_PATTERNS = [
    # Retention (PPF)
    (r"(?:retention|retained|retain)\s*(?:at|:)?\s*(\d+(?:\.\d+)?%?)", "retention", "retention_pct"),
    (r"(?:d90|day\s*90|90\s*day)\s*(?:retention)?\s*(?:at|:)?\s*(\d+(?:\.\d+)?%?)", "retention", "d90_retention"),
    (r"(?:monthly|weekly)\s*retention\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?%?)", "retention", "retention_rate"),
    # Revenue
    (r"(?:arr|annual\s*recurring)\s*(?:of|:)?\s*[\$₹]?\s*(\d+(?:\.\d+)?[kKmMlLcC]?)", "revenue", "arr"),
    (r"(?:mrr|monthly\s*recurring)\s*(?:of|:)?\s*[\$₹]?\s*(\d+(?:\.\d+)?[kKmMlLcC]?)", "revenue", "mrr"),
    (r"[\$₹]\s*(\d+(?:\.\d+)?[kKmM]?)\s*(?:arr|mrr|revenue)", "revenue", "revenue"),
    (r"(\d+(?:\.\d+)?[kKlLcCrR]?)\s*(?:lakh|cr|inr)\s*(?:arr|revenue)", "revenue", "revenue_inr"),
    # Unit economics (MMF / GRUE)
    (r"(?:cac|customer\s*acquisition\s*cost)\s*(?:of|:)?\s*[\$₹]?\s*(\d+(?:\.\d+)?[kK]?)", "unit_economics", "cac"),
    (r"(?:ltv|lifetime\s*value)\s*(?:of|:)?\s*[\$₹]?\s*(\d+(?:\.\d+)?[kK]?)", "unit_economics", "ltv"),
    (r"ltv[\s/:]\s*cac\s*(?:of|:)?\s*(\d+(?:\.\d+)?)", "unit_economics", "ltv_cac"),
    (r"churn\s*(?:rate)?\s*(?:of|:)?\s*(\d+(?:\.\d+)?%?)", "unit_economics", "churn"),
    (r"cm2\+|contribution\s*margin|path\s*to\s*profit", "unit_economics", "cm2"),
    # Growth
    (r"(\d+(?:\.\d+)?%)\s*(?:mom|month[\-\s]over[\-\s]month)", "growth", "mom"),
    (r"(\d+[xX])\s*growth", "growth", "multiple"),
    (r"(\d+[kKmM]?\+?)\s*(?:paying\s+)?customers?", "traction", "customers"),
    (r"(\d+[kKmM]?\+?)\s*(?:active\s+)?users?", "traction", "users"),
]

# Vague/aspirational patterns that should be flagged Unverified with Counter-Question
VAGUE_PATTERNS = [
    (r"many\s+(?:users|customers|clients)", "What is the exact number of users/customers?"),
    (r"strong\s+(?:traction|growth|retention)", "What is the exact retention/growth number?"),
    (r"significant\s+(?:revenue|traction)", "What is the exact ARR/MRR?"),
    (r"growing\s+(?:fast|quickly|well)", "What is the MoM or YoY growth percentage?"),
    (r"we\s+have\s+(?:good|great|strong)\s+", "Specify the metric and number."),
]


def _load_pedigree_knowledge() -> Dict[str, Any]:
    """Load pedigree_knowledge.json for PedigreeScanner (Indian Mafia 50+, IIT/IIM/BITS)."""
    for base in [os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".", os.getcwd()]:
        path = os.path.join(base, "data", "pedigree_knowledge.json")
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return {
        "indian_mafia_startups": [],
        "tier1_colleges": {"iit": [], "iim": [], "bits": [], "other_tier1": []},
        "grue_core_metrics": GRUE_CORE_METRICS,
        "high_pedigree_multiplier": 1.0,
    }


def _check_pedigree(text: str) -> Dict[str, Any]:
    """Tag lead with High-Pedigree if text mentions Indian Mafia or tier-1 (IIT/IIM). Returns tags and multiplier."""
    data = _load_pedigree_knowledge()
    text_lower = (text or "").lower()
    tags: List[str] = []
    for company in data.get("indian_mafia_startups", [])[:60]:
        if company and company.lower() in text_lower:
            tags.append("indian_mafia")
            break
    for tier, colleges in data.get("tier1_colleges", {}).items():
        for c in (colleges or []):
            if c and c.lower() in text_lower:
                tags.append(tier)
                break
    multiplier = data.get("high_pedigree_multiplier", 1.0) if tags else 1.0
    return {"high_pedigree": len(tags) > 0, "pedigree_tags": list(set(tags)), "pedigree_multiplier": multiplier}


def _extract_signals_with_evidence(text: str) -> List[Dict[str, Any]]:
    """Extract GRUE-aligned signals with exact quote (evidence log)."""
    results = []
    seen: Dict[str, str] = {}
    for pattern, signal_type, subtype in EVIDENCE_SIGNAL_PATTERNS:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            value = m.group(1) if m.lastindex and m.lastindex >= 1 else m.group(0)
            quote = m.group(0).strip()
            key = f"{signal_type}:{subtype}:{value}"
            if key not in seen:
                seen[key] = quote
                results.append({
                    "type": signal_type,
                    "subtype": subtype,
                    "value": value,
                    "evidence": quote,
                })
    return results


def _strip_meeting_noise(text: str) -> str:
    """Remove common meeting transcript noise (fillers, repeated timestamps)."""
    t = text
    # Remove [inaudible], (crosstalk), etc.
    t = re.sub(r'\[[^\]]*\]', ' ', t, flags=re.IGNORECASE)
    t = re.sub(r'\([^)]*\)', ' ', t)
    # Collapse repeated spaces/newlines
    t = re.sub(r'\s+', ' ', t)
    t = re.sub(r'\n\s*\n', '\n', t)
    return t.strip()


# =============================================================================
# Source Type Detection (SemanticDistiller)
# =============================================================================

SOURCE_TYPES = ("transcript", "note", "dictation")

def detect_source_type(text: str, api_key: Optional[str] = None) -> str:
    """
    Detect source type: transcript (meeting), note (structured/bullets), dictation (Wispr brain dump).
    Uses heuristics first; optional LLM for ambiguous cases.
    """
    t = text.strip()
    if len(t) < 50:
        return "note"

    # Heuristics
    has_timestamps = bool(re.search(r"\d{1,2}:\d{2}\s*[-\–]|\d{1,2}\s*:\s*\d{2}", t))
    has_speaker_labels = bool(re.search(r"^(?:founder|investor|sajith|pi|q\s*[:\-]|a\s*[:\-])", t, re.MULTILINE | re.IGNORECASE))
    bullet_count = len(re.findall(r"^[\s]*[-*•]\s+", t, re.MULTILINE))
    sentence_count = len(re.findall(r"[.!?]\s+", t)) + 1
    avg_len = len(t) / max(sentence_count, 1)
    # Dictation: long run-on sentences, first-person, stream-of-thought
    run_on = avg_len > 120 or (t.count(" and ") + t.count(" so ") > 3 and bullet_count < 2)
    wispr_granola_markers = "wispr" in t.lower() or "granola" in t.lower() or "meeting notes" in t.lower()

    if has_timestamps or has_speaker_labels or "transcript" in t.lower():
        return "transcript"
    if bullet_count >= 3 and not run_on:
        return "note"
    if run_on or wispr_granola_markers:
        return "dictation"

    if _get_llm_config(api_key)[0]:
        try:
            return _detect_source_type_llm(t, api_key)
        except Exception:
            pass
    return "note" if bullet_count >= 1 else "dictation"


def _detect_source_type_llm(text: str, api_key: str) -> str:
    """Use LLM to classify source type when heuristics are ambiguous."""
    prompt = f"""Classify the following content as exactly one of: transcript, note, dictation.

- transcript: meeting/call transcript with speakers or timestamps.
- note: structured notes (bullets, sections, short lines).
- dictation: voice-to-text brain dump, long run-on sentences, stream of thought.

Content:
{text[:2000]}

Reply with only one word: transcript, note, or dictation."""

    out = _llm_chat([{"role": "user", "content": prompt}], openai_api_key=api_key, max_tokens=10).lower()
    for s in SOURCE_TYPES:
        if s in out:
            return s
    return "note"


# =============================================================================
# Granola: Transcript → Hard signals + Evidence Log
# =============================================================================

def process_granola_transcript(
    text: str,
    api_key: Optional[str] = None,
    persona_name: str = "the VC",
) -> Dict[str, Any]:
    """
    Strip meeting noise and extract hard signals (Retention, ARR, CAC) with Evidence Log.
    Skeptical Associate: vague signals marked Unverified, questions for next meeting.
    """
    cleaned = _strip_meeting_noise(text)
    signals_raw = _extract_signals_with_evidence(cleaned)

    # Build evidence log and classify verified vs unverified (Skeptical Principal)
    evidence_log: List[Dict[str, Any]] = []
    unverified: List[Dict[str, Any]] = []
    for s in signals_raw:
        entry = {
            "signal": f"{s['type']}_{s['subtype']}",
            "value": s["value"],
            "evidence": s["evidence"],
            "verified": _is_verifiable(s, cleaned),
        }
        evidence_log.append(entry)
        if not entry["verified"]:
            unverified.append(entry)

    # Skeptical Principal: Evidence for every signal; Counter-Question for Unverified
    evidence_log = _skeptical_principal_review(evidence_log, cleaned, api_key, persona_name)
    unverified = [e for e in evidence_log if not e.get("verified")]

    # Blind spots: Sajith GRUE core metrics (Growth, Retention, Unit Economics) — any missing MUST become Question for Next Meeting
    data = _load_pedigree_knowledge()
    core_metrics = data.get("grue_core_metrics") or GRUE_CORE_METRICS
    mentioned = {e["signal"] for e in evidence_log}
    # Normalize: evidence_log uses e.g. "retention_retention_pct"; we want "retention" in blind_spots
    mentioned_base = set()
    for s in mentioned:
        for c in core_metrics:
            if c in s or s.startswith(c + "_"):
                mentioned_base.add(c)
                break
    blind_spots = [m for m in core_metrics if m not in mentioned_base]

    # Questions for next meeting (include counter_questions from unverified)
    questions = _suggest_follow_ups(unverified, blind_spots, api_key, persona_name)
    for u in unverified:
        cq = u.get("counter_question")
        if cq and cq not in questions:
            questions.insert(0, cq)
    questions = questions[:15]

    pedigree = _check_pedigree(cleaned)
    return {
        "source_type": "transcript",
        "tool": "granola",
        "cleaned_preview": cleaned[:1500],
        "evidence_log": evidence_log,
        "unverified_signals": unverified,
        "blind_spots": blind_spots,
        "questions_for_next_meeting": questions,
        "immediate_appraisal": _immediate_appraisal_from_signals(
            evidence_log, blind_spots, questions, "Granola transcript",
            conflict_report=None, pedigree=pedigree,
        ),
        "pedigree": pedigree,
    }


def _is_verifiable(signal: Dict[str, Any], full_text: str) -> bool:
    """Harsh but fair: numeric and specific = verified; vague = unverified."""
    v = (signal.get("value") or "").strip()
    if not v:
        return False
    if re.match(r"^\d+(\.\d+)?%?\s*$", v) or re.match(r"^[\$₹]?\d+", v) or re.match(r"^\d+[kKmMxX]", v):
        return True
    if len(v) > 30 and "path" in full_text.lower() and "cm2" in full_text.lower():
        return True
    return False


def _counter_question_for_signal(signal_key: str, value: str) -> str:
    """Skeptical Principal: one counter-question for unverified/vague signal."""
    key = (signal_key or "").lower()
    if "retention" in key or "d90" in key:
        return "What is the exact D90 retention?"
    if "arr" in key or "mrr" in key or "revenue" in key:
        return "What is the exact ARR/MRR number?"
    if "cac" in key or "ltv" in key:
        return "What is your CAC and LTV/CAC?"
    if "churn" in key:
        return "What is the monthly churn rate?"
    if "customers" in key or "users" in key:
        return "What is the exact paying customer/user count?"
    if "growth" in key or "mom" in key:
        return "What is the exact MoM or YoY growth percentage?"
    return f"Provide a specific number or metric for: {signal_key} (currently: {value})"


def _skeptical_principal_review(
    evidence_log: List[Dict[str, Any]],
    cleaned_text: str,
    api_key: Optional[str],
    persona_name: str,
) -> List[Dict[str, Any]]:
    """
    Skeptical Principal: ensure every entry has Evidence (exact quote); add counter_question for Unverified.
    Optionally use LLM to tighten evidence quotes and counter-questions.
    """
    for entry in evidence_log:
        entry.setdefault("evidence", entry.get("value", ""))
        if not entry.get("verified"):
            entry["counter_question"] = _counter_question_for_signal(entry.get("signal", ""), entry.get("value", ""))
        else:
            entry["counter_question"] = None
    if _get_llm_config(api_key)[0] and len(evidence_log) > 0:
        try:
            return _skeptical_principal_llm(evidence_log, cleaned_text[:2500], api_key, persona_name)
        except Exception:
            pass
    return evidence_log


def _skeptical_principal_llm(
    evidence_log: List[Dict[str, Any]],
    transcript_snippet: str,
    api_key: Optional[str],
    persona_name: str,
) -> List[Dict[str, Any]]:
    """
    Skeptical Principal (LLM): Identify Blind Spots using Sajith's GRUE (Growth, Retention, Unit Economics).
    For every verified signal, output the exact transcript quote as Evidence.
    For unverified/vague signals, output a Counter-Question. If a core GRUE metric is missing, it MUST be listed as a Question for Next Meeting.
    """
    unverified = [e for e in evidence_log if not e.get("verified")]
    if not unverified:
        return evidence_log
    prompt = f"""You are a Skeptical Principal for {persona_name}. Use Sajith's GRUE framework: Growth, Retention, Unit Economics. Core metrics: retention (e.g. D90), ARR/MRR, CAC, LTV/CAC, churn.

For each UNVERIFIED signal below:
1. Evidence: the exact quote from the transcript (or "Not stated" if absent).
2. Counter-Question: one sharp question to pin down the real number (e.g. "What is the exact D90 retention?").

If a core GRUE metric is missing from the conversation, it MUST be listed as a Question for Next Meeting.

Transcript snippet:
{transcript_snippet[:2000]}

Unverified signals (signal, value):
{json.dumps([{{"signal": e.get("signal"), "value": e.get("value")}} for e in unverified], indent=2)}

Respond with valid JSON only, array of objects in same order:
[{{"signal": "<key>", "evidence": "<exact quote from transcript>", "counter_question": "<one question>"}}, ...]
"""
    raw = _llm_chat([{"role": "user", "content": prompt}], openai_api_key=api_key, temperature=0.2, max_tokens=500)
    try:
        start, end = raw.find("["), raw.rfind("]") + 1
        if start >= 0 and end > start:
            llm_list = json.loads(raw[start:end])
            for i, e in enumerate(evidence_log):
                if not e.get("verified") and i < len(llm_list):
                    llm_e = llm_list[i]
                    if llm_e.get("evidence"):
                        e["evidence"] = llm_e["evidence"]
                    if llm_e.get("counter_question"):
                        e["counter_question"] = llm_e["counter_question"]
    except (json.JSONDecodeError, IndexError, KeyError):
        pass
    return evidence_log


def _suggest_follow_ups(
    unverified: List[Dict[str, Any]],
    blind_spots: List[str],
    api_key: Optional[str],
    persona_name: str,
) -> List[str]:
    """
    Skeptical Principal / GRUE: Every missing core metric (Blind Spot) MUST be listed as a Question for Next Meeting.
    Sajith's GRUE = Growth, Retention, Unit Economics.
    """
    questions = []
    for u in unverified:
        cq = u.get("counter_question")
        if cq and cq not in questions:
            questions.append(cq)
        else:
            questions.append(f"Clarify or provide number for: {u.get('signal', '')} (currently: {u.get('value', '')})")
    # GRUE: every blind spot MUST become a Question for Next Meeting
    for b in blind_spots:
        if b == "retention":
            q = "What's your retention curve? D90 retention?"
        elif b in ("arr", "mrr", "revenue"):
            q = "Current ARR/MRR? Revenue number?"
        elif b in ("cac", "ltv", "ltv_cac"):
            q = "What's your CAC and LTV/CAC?"
        elif b == "churn":
            q = "Monthly churn rate?"
        elif b == "growth":
            q = "What is MoM or YoY growth percentage?"
        elif b in ("customers", "users"):
            q = "Exact paying customer or user count?"
        else:
            q = f"Provide core metric: {b} (GRUE framework)."
        if q not in questions:
            questions.append(q)
    return questions[:20]


def _immediate_appraisal_from_signals(
    evidence_log: List[Dict[str, Any]],
    blind_spots: List[str],
    questions: List[str],
    source_label: str,
    conflict_report: Optional[List[Dict[str, Any]]] = None,
    pedigree: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build Immediate Appraisal (structured + Markdown) and GRUE verdict."""
    verified = [e for e in evidence_log if e.get("verified")]
    hook = "No hard GRUE signals yet."
    if verified:
        types = set(e.get("signal", "") for e in verified)
        hook = f"From {source_label}: " + ", ".join(sorted(types)) + ". Verify in next meeting."
    conflicts = conflict_report or []
    # GRUE verdict: High / Medium / Low based on verified count, blind spots, conflicts
    if pedigree and pedigree.get("high_pedigree"):
        grue_verdict = "Medium" if len(verified) >= 2 else "Low"
        if len(verified) >= 4 and not blind_spots and not conflicts:
            grue_verdict = "High"
    else:
        if len(verified) >= 4 and not blind_spots and not conflicts:
            grue_verdict = "High"
        elif len(verified) >= 2 and len(blind_spots) <= 2:
            grue_verdict = "Medium"
        else:
            grue_verdict = "Low"
    if conflicts:
        grue_verdict = "Low" if grue_verdict != "High" else "Medium"

    # Conviction score 0–1 for API / Phase 3
    verdict_score = {"High": 0.8, "Medium": 0.5, "Low": 0.2}.get(grue_verdict, 0.2)
    signal_boost = min(0.15, len(verified) * 0.03)  # cap boost from verified count
    conviction_score = round(min(1.0, verdict_score + signal_boost), 2)

    appraisal = {
        "hook": hook[:300],
        "signal_count": len(evidence_log),
        "verified_count": len(verified),
        "blind_spots": blind_spots,
        "questions_for_next_meeting": questions,
        "conflict_report": conflicts,
        "grue_verdict": grue_verdict,
        "conviction_score": conviction_score,
        "pedigree": pedigree,
    }
    appraisal["immediate_appraisal_markdown"] = _build_appraisal_markdown(
        hook, verified, evidence_log, blind_spots, conflicts, grue_verdict, pedigree
    )
    return appraisal


def _build_appraisal_markdown(
    hook: str,
    verified: List[Dict[str, Any]],
    evidence_log: List[Dict[str, Any]],
    blind_spots: List[str],
    conflicts: List[Dict[str, Any]],
    grue_verdict: str,
    pedigree: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Beautiful, scannable Markdown: The Hook, Verified Signals (exact Evidence Quotes),
    Risks & Conflicts (red flags), GRUE Verdict (High/Medium/Low).
    """
    lines = [
        "---",
        "",
        "### The Hook",
        "",
        "> " + hook.replace("\n", "\n> "),
        "",
        "---",
        "",
        "### Verified Signals",
        "",
    ]
    if verified:
        for e in verified:
            ev = (e.get("evidence") or e.get("value") or "").strip()
            ev_short = ev[:180] + "…" if len(ev) > 180 else ev
            lines.append(f"- **{e.get('signal', '')}** — `{e.get('value', '')}`")
            lines.append(f"  _Evidence:_ \"{ev_short}\"")
            lines.append("")
    else:
        lines.append("_No verified GRUE signals; all claims need follow-up._")
        lines.append("")
    lines.extend([
        "---",
        "",
        "### Risks & Conflicts",
        "",
    ])
    red_flags: List[str] = []
    for b in blind_spots:
        red_flags.append(f"**Blind spot:** {b} not stated (add to Questions for Next Meeting).")
    for c in conflicts:
        red_flags.append(f"**Conflict:** {c.get('summary', c.get('metric', 'N/A'))} — transcript: `{c.get('transcript_value', '')}` vs dictation: `{c.get('dictation_value', '')}`")
    if red_flags:
        for r in red_flags:
            lines.append("- " + r)
        lines.append("")
    else:
        lines.append("_None identified._")
        lines.append("")
    lines.extend([
        "---",
        "",
        "### GRUE Verdict",
        "",
        f"**{grue_verdict}** — " + _grue_verdict_rationale(grue_verdict, pedigree),
        "",
        "---",
    ])
    return "\n".join(lines)


def _grue_verdict_rationale(verdict: str, pedigree: Optional[Dict[str, Any]]) -> str:
    if verdict == "High":
        return "Strong verified signals; low blind spots; worth a meeting."
    if verdict == "Medium":
        return "Some verified signals; clarify blind spots or conflicts in next touch."
    return "Insufficient verified GRUE signals or material conflicts; pass or deep-dive only if bandwidth."


# =============================================================================
# Conflict Reporter: Self-Reported Dictation (Wispr) vs Fact-Based Transcript (Granola)
# =============================================================================

def generate_conflict_report(
    transcript_result: Dict[str, Any],
    dictation_result: Dict[str, Any],
    transcript_text: Optional[str] = None,
    dictation_text: Optional[str] = None,
    api_key: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Compare Wispr (self-reported dictation) vs Granola (fact-based transcript).
    Type A/B: factual/tonal conflicts (same metric, different value).
    Type C: omission conflicts — topic/concern in dictation that was absent from transcript.
    """
    conflicts: List[Dict[str, Any]] = []
    t_log = {e.get("signal"): e for e in (transcript_result.get("evidence_log") or [])}
    d_log = {e.get("signal"): e for e in (dictation_result.get("evidence_log") or [])}
    all_signals = set(t_log.keys()) | set(d_log.keys())
    for sig in all_signals:
        t_e = t_log.get(sig)
        d_e = d_log.get(sig)
        if not t_e or not d_e:
            continue
        tv = (t_e.get("value") or "").strip()
        dv = (d_e.get("value") or "").strip()
        if tv and dv and tv != dv:
            conflicts.append({
                "conflict_type": "factual",
                "metric": sig,
                "transcript_value": tv,
                "dictation_value": dv,
                "summary": f"{sig}: meeting said \"{tv}\" but dictation says \"{dv}\"",
            })

    # Type C: Omission — concerns/topics in dictation not addressed in transcript
    if transcript_text and dictation_text and _get_llm_config(api_key)[0]:
        omission_conflicts = _detect_omission_conflicts(transcript_text, dictation_text, api_key)
        conflicts.extend(omission_conflicts)

    return conflicts


def _detect_omission_conflicts(
    transcript_text: str,
    dictation_text: str,
    api_key: Optional[str],
) -> List[Dict[str, Any]]:
    """Type C: Topics or concerns mentioned in dictation that were notably absent from transcript."""
    out: List[Dict[str, Any]] = []
    prompt = """You are a diligence analyst. Given:
1) MEETING TRANSCRIPT (what was said in the formal meeting):
"""
    prompt += transcript_text[:4000] + "\n\n2) VC'S PRIVATE NOTES/DICTATION (post-meeting):\n"
    prompt += dictation_text[:3000]
    prompt += """

List any TOPICS or CONCERNS that appear in the private notes/dictation but were NOT meaningfully addressed in the meeting transcript. (E.g. "concern about unit economics", "founder credibility doubt", "churn not discussed".)
Reply with a JSON array of short strings only, one per omission. If none, reply: []
Example: ["churn never mentioned", "founder seemed evasive on retention"]
"""
    try:
        key, url, model = _get_llm_config(api_key)
        if not key:
            return out
        messages = [{"role": "user", "content": prompt}]
        raw = _llm_chat(messages, api_key, temperature=0.1, max_tokens=400)
        raw = raw.strip()
        if raw.startswith("["):
            # Find the array (in case of markdown)
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if end > start:
                arr = json.loads(raw[start:end])
                for item in (arr or [])[:10]:
                    if isinstance(item, str) and item.strip():
                        out.append({
                            "conflict_type": "omission",
                            "metric": "omission",
                            "transcript_value": "",
                            "dictation_value": item.strip(),
                            "summary": f"Not in transcript: {item.strip()}",
                        })
    except (json.JSONDecodeError, ValueError, KeyError):
        pass
    return out


# =============================================================================
# Wispr: Dictation → Investment Thesis Fragment
# =============================================================================

def process_wispr_dictation(
    text: str,
    api_key: Optional[str] = None,
    persona_name: str = "the VC",
) -> Dict[str, Any]:
    """
    Reorganize voice-to-text brain dump into structured Investment Thesis Fragment.
    Skeptical Associate: flag vague claims, add questions for next meeting.
    """
    signals_raw = _extract_signals_with_evidence(text)
    evidence_log = [{"signal": f"{s['type']}_{s['subtype']}", "value": s["value"], "evidence": s["evidence"], "verified": _is_verifiable(s, text)} for s in signals_raw]
    unverified = [e for e in evidence_log if not e.get("verified")]
    data = _load_pedigree_knowledge()
    core_metrics = data.get("grue_core_metrics") or GRUE_CORE_METRICS
    mentioned = {e["signal"] for e in evidence_log}
    mentioned_base = set()
    for s in mentioned:
        for c in core_metrics:
            if c in s or s.startswith(c + "_"):
                mentioned_base.add(c)
                break
    blind_spots = [m for m in core_metrics if m not in mentioned_base]
    questions = _suggest_follow_ups(unverified, blind_spots, api_key, persona_name)

    thesis_fragment: Dict[str, Any] = {
        "problem": "",
        "solution": "",
        "traction": [e for e in evidence_log if str(e.get("signal", "")).startswith(("revenue", "traction", "retention", "growth"))],
        "ask": "",
    }

    if _get_llm_config(api_key)[0]:
        try:
            thesis_fragment = _reorganize_thesis_llm(text, evidence_log, api_key, persona_name)
        except Exception:
            pass

    pedigree = _check_pedigree(text)
    out = {
        "source_type": "dictation",
        "tool": "wispr",
        "evidence_log": evidence_log,
        "unverified_signals": unverified,
        "blind_spots": blind_spots,
        "questions_for_next_meeting": questions,
        "immediate_appraisal": _immediate_appraisal_from_signals(
            evidence_log, blind_spots, questions, "Wispr dictation",
            conflict_report=None, pedigree=pedigree,
        ),
        "investment_thesis_fragment": thesis_fragment,
        "pedigree": pedigree,
    }
    return out


def _reorganize_thesis_llm(
    text: str,
    evidence_log: List[Dict[str, Any]],
    api_key: str,
    persona_name: str,
) -> Dict[str, Any]:
    """LLM: reorganize brain dump into problem, solution, traction, ask. Skeptical Associate persona."""
    prompt = f"""You are a Harsh but Fair associate for {persona_name}. Reorganize this voice-to-text brain dump into a structured Investment Thesis Fragment.

GRUE framework (India VC): Growth, Retention, Unit Economics. We care about PPF (product-problem fit), MMF (motion-market fit), retention, ARR, CAC, LTV/CAC, path to CM2+.

Extract and fill only what is clearly stated. If something is vague, do NOT invent it. Prefer leaving a field short over guessing.

Brain dump:
{text[:3500]}

Signals already extracted (use these): {evidence_log}

Respond with valid JSON only:
{{
  "problem": "<one sentence if stated, else empty>",
  "solution": "<one sentence if stated, else empty>",
  "traction": [{{"signal": "<type>", "value": "<value>", "evidence": "<quote>"}}],
  "ask": "<what they are asking for if stated, else empty>"
}}"""

    raw = _llm_chat([{"role": "user", "content": prompt}], openai_api_key=api_key, temperature=0.2, max_tokens=600)
    try:
        start, end = raw.find("{"), raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError:
        pass
    return {"problem": "", "solution": "", "traction": [], "ask": ""}


# =============================================================================
# SemanticDistiller (unified entry)
# =============================================================================

def distill(
    text: Optional[str] = None,
    api_key: Optional[str] = None,
    persona_name: str = "the VC",
    tool_hint: Optional[str] = None,
    transcript_text: Optional[str] = None,
    dictation_text: Optional[str] = None,
) -> Dict[str, Any]:
    """
    SemanticDistiller: single source (text) or dual source (transcript + dictation) with Conflict Reporting.
    Returns evidence_log, blind_spots, immediate_appraisal (with immediate_appraisal_markdown), conflict_report, pedigree.
    """
    # Dual-source: Granola (transcript) + Wispr (dictation) with Conflict Report
    if (transcript_text or "").strip() and (dictation_text or "").strip():
        granola = process_granola_transcript(transcript_text.strip(), api_key, persona_name)
        wispr = process_wispr_dictation(dictation_text.strip(), api_key, persona_name)
        conflict_report = generate_conflict_report(
            granola, wispr,
            transcript_text=transcript_text.strip(),
            dictation_text=dictation_text.strip(),
            api_key=api_key,
        )
        # Use transcript as primary evidence; merge blind spots and questions
        evidence_log = granola.get("evidence_log") or []
        blind_spots = list(set((granola.get("blind_spots") or []) + (wispr.get("blind_spots") or [])))
        questions = list(dict.fromkeys((granola.get("questions_for_next_meeting") or []) + (wispr.get("questions_for_next_meeting") or [])))[:15]
        pedigree = granola.get("pedigree") or wispr.get("pedigree") or _check_pedigree(transcript_text + " " + dictation_text)
        immediate_appraisal = _immediate_appraisal_from_signals(
            evidence_log, blind_spots, questions, "Granola + Wispr (with conflict check)",
            conflict_report=conflict_report, pedigree=pedigree,
        )
        ai_polish = _run_ai_polish_detection(transcript_text.strip())
        return {
            "source_type": "transcript",
            "tool": "granola+wispr",
            "source_metadata": {"source_type": "transcript", "tool": "granola+wispr", "dual_source": True},
            "evidence_log": evidence_log,
            "unverified_signals": granola.get("unverified_signals") or [],
            "blind_spots": blind_spots,
            "questions_for_next_meeting": questions,
            "conflict_report": conflict_report,
            "immediate_appraisal": immediate_appraisal,
            "pedigree": pedigree,
            "ai_polish": ai_polish,
            "granola_preview": granola.get("cleaned_preview", ""),
            "wispr_thesis_fragment": wispr.get("investment_thesis_fragment"),
        }

    text = (text or "").strip()
    if not text:
        return {
            "source_type": "note",
            "tool": tool_hint or "unknown",
            "source_metadata": {"source_type": "note", "tool": tool_hint or "unknown"},
            "evidence_log": [],
            "unverified_signals": [],
            "blind_spots": [],
            "questions_for_next_meeting": [],
            "conflict_report": [],
            "immediate_appraisal": {
                "hook": "No content.",
                "signal_count": 0,
                "verified_count": 0,
                "blind_spots": [],
                "questions_for_next_meeting": [],
                "immediate_appraisal_markdown": _build_appraisal_markdown(
                    "No content.", [], [], [], [], "Low", None
                ),
                "grue_verdict": "Low",
            },
        }

    source_type = detect_source_type(text, api_key)
    if tool_hint and tool_hint.lower() in ("granola", "wispr"):
        source_type = "transcript" if tool_hint.lower() == "granola" else "dictation"

    if source_type == "transcript":
        out = process_granola_transcript(text, api_key, persona_name)
    elif source_type == "dictation":
        out = process_wispr_dictation(text, api_key, persona_name)
    else:
        out = process_granola_transcript(text, api_key, persona_name)
        out["source_type"] = "note"
        out["tool"] = tool_hint or "note"

    out["source_metadata"] = {"source_type": out["source_type"], "tool": out.get("tool", "unknown")}
    out["conflict_report"] = []
    out["ai_polish"] = _run_ai_polish_detection(text)
    if "immediate_appraisal" in out and "immediate_appraisal_markdown" not in out.get("immediate_appraisal", {}):
        appr = out["immediate_appraisal"]
        appr["immediate_appraisal_markdown"] = _build_appraisal_markdown(
            appr.get("hook", ""),
            [e for e in (out.get("evidence_log") or []) if e.get("verified")],
            out.get("evidence_log") or [],
            appr.get("blind_spots") or [],
            [],
            appr.get("grue_verdict", "Low"),
            appr.get("pedigree"),
        )
    return out
