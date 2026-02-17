"""
Automated Analyst Memo Generator (OS for Investors).
Builds a structured Investment Memo Fragment from triage state and evaluation.
Supports LLM-generated memo (tenant-aware) or rule-based fallback.
"""

import json
from typing import Any, Dict, List, Optional

import httpx

OPENAI_MODEL = "gpt-3.5-turbo"
OPENAI_TIMEOUT = 25
OPENAI_MAX_RETRIES = 2


# =============================================================================
# Rule-based helpers (fallback and inputs for LLM)
# =============================================================================

def score_to_priority(score: int, recommendation: str) -> str:
    """Map evaluation score/recommendation to High/Medium/Low priority."""
    if recommendation == "recommend_meeting" or score >= 8:
        return "High"
    if recommendation == "recommend_if_bandwidth" or (score >= 6 and score < 8):
        return "Medium"
    return "Low"


def get_suggested_next_step(priority: str, recommendation: str) -> str:
    """Suggest a concrete next step from priority/recommendation."""
    if priority == "High" or recommendation == "recommend_meeting":
        return "Schedule 15m intro"
    if priority == "Medium" or recommendation == "recommend_if_bandwidth":
        return "Review when bandwidth allows; consider short intro"
    if recommendation == "refer_out":
        return "Refer to other resources or programs"
    return "No meeting; send polite pass"


def build_red_flags(
    state: Dict[str, Any],
    evaluation: Dict[str, Any],
) -> List[str]:
    """Collect AI-detection and behavioral anomalies from the conversation."""
    flags: List[str] = []

    cumulative_ai = state.get("cumulative_ai_score") or 0
    if cumulative_ai >= 0.6:
        flags.append(f"High AI probability ({cumulative_ai:.2f})")
    elif cumulative_ai >= 0.4:
        flags.append(f"Moderate AI signals ({cumulative_ai:.2f})")

    for d in state.get("ai_detection_history", []):
        for f in d.get("flags", [])[:3]:
            if f and f not in flags:
                flags.append(f)

    for b in state.get("behavioral_history", []):
        if b.get("evasion_flag"):
            flags.append("Evasive or non-specific response")
        for rf in b.get("red_flags", []):
            if rf and rf not in flags:
                flags.append(rf)

    if state.get("hardcoded_rejection") and state.get("hardcoded_rejection_reason"):
        flags.append(state["hardcoded_rejection_reason"])

    for factor in evaluation.get("scoring_factors", [])[:5]:
        if factor and factor not in flags:
            flags.append(factor)

    return flags[:15]


def build_signal_summary_bullets(state: Dict[str, Any]) -> List[str]:
    """Build a bulleted list of traction and credentials from state."""
    bullets: List[str] = []
    signals = state.get("concrete_signals") or {}
    traction = signals.get("traction") or []
    credentials = signals.get("credentials") or []

    for t in traction:
        if isinstance(t, dict):
            bullets.append(f"Traction: {t.get('raw_match', t.get('value', str(t)))}")
        else:
            bullets.append(f"Traction: {t}")

    for c in credentials:
        if isinstance(c, str):
            bullets.append(f"Credential: {c}")
        else:
            bullets.append(f"Credential: {c.get('raw_match', c.get('value', str(c)))}")

    if not bullets:
        bullets.append("No concrete traction or credentials extracted.")
    return bullets[:20]


def _transcript_from_messages(messages: List[Dict[str, str]]) -> str:
    """Turn conversation messages into a plain transcript."""
    lines = []
    for m in messages:
        role = (m.get("role") or "user").capitalize()
        content = (m.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n\n".join(lines)


# =============================================================================
# Tenant-aware memo prompt (for LLM)
# =============================================================================

def get_memo_fragment_prompt(
    transcript: str,
    signal_summary_bullets: List[str],
    red_flags_list: List[str],
    evaluation: Dict[str, Any],
    persona_name: str,
) -> str:
    """Generate tenant-aware prompt for Investment Memo Fragment (analyst memo)."""
    score = evaluation.get("score", 5)
    recommendation = evaluation.get("recommendation") or "refer_out"
    rationale = evaluation.get("rationale") or []

    return f"""You are writing a short **Investment Memo Fragment** for {persona_name}'s deal flow. This will be used by {persona_name} (or their team) to decide next steps.

## CONVERSATION TRANSCRIPT
{transcript}

## EXTRACTED SIGNALS (from triage)
{chr(10).join('- ' + b for b in signal_summary_bullets)}

## RED FLAGS / ANOMALIES (from triage)
{chr(10).join('- ' + f for f in red_flags_list) if red_flags_list else '- None noted'}

## EVALUATION CONTEXT
- Score: {score}/10
- Recommendation: {recommendation}
- Rationale: {rationale}

## YOUR TASK
Produce a structured memo fragment in JSON only. No markdown, no explanation outside JSON.

Output this exact structure:
{{
  "hook": "<One sentence on why this founder stands out or why they don't. Be specific.>",
  "signal_summary": [
    "<bullet 1: traction or credential>",
    "<bullet 2>",
    "<bullet 3>"
  ],
  "red_flags": [
    "<summary of AI/behavioral concern 1>",
    "<summary 2>"
  ],
  "recommendation": {{
    "priority": "<High|Medium|Low>",
    "next_step": "<Concrete next step, e.g. Schedule 15m intro, Refer out, No meeting>"
  }}
}}

Rules:
- hook: One sentence only. Capture the standout reason (or main reason to pass).
- signal_summary: Use the extracted signals above; you may rephrase into 3–6 clear bullets.
- red_flags: Summarize any AI-detection or behavioral issues; leave empty array if none.
- recommendation.priority: High (worth meeting), Medium (if bandwidth), Low (pass).
- recommendation.next_step: One short phrase, e.g. "Schedule 15m intro", "Refer to X", "Polite pass".

Respond with valid JSON only."""


# =============================================================================
# LLM-based memo generation
# =============================================================================

def _chat_completion_sync(
    api_key: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    max_tokens: int = 800,
) -> str:
    """Synchronous OpenAI chat completion (mirrors lib/evaluation.py pattern)."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    with httpx.Client(timeout=OPENAI_TIMEOUT) as client:
        for attempt in range(OPENAI_MAX_RETRIES + 1):
            try:
                r = client.post(url, json=payload, headers=headers)
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"].strip()
            except (httpx.TimeoutException, httpx.HTTPStatusError):
                if attempt == OPENAI_MAX_RETRIES:
                    raise
    raise Exception("Max retries exceeded")


def generate_memo_fragment_llm(
    api_key: str,
    state: Dict[str, Any],
    evaluation: Dict[str, Any],
    persona_name: str,
) -> Dict[str, Any]:
    """
    Generate Investment Memo Fragment using the LLM (tenant-aware).
    Uses extracted_signals and conversation_history from state.
    Returns: hook, signal_summary, red_flags, recommendation (priority, next_step).
    """
    transcript = _transcript_from_messages(state.get("messages") or [])
    signal_bullets = build_signal_summary_bullets(state)
    red_flags_list = build_red_flags(state, evaluation)

    prompt = get_memo_fragment_prompt(
        transcript,
        signal_bullets,
        red_flags_list,
        evaluation,
        persona_name,
    )

    messages = [
        {"role": "system", "content": "You are an analyst assistant. Respond only with valid JSON."},
        {"role": "user", "content": prompt},
    ]
    raw = _chat_completion_sync(api_key, messages, temperature=0.3, max_tokens=800)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            memo = json.loads(raw[start:end])
        else:
            raise ValueError("No JSON in response")
    except (json.JSONDecodeError, ValueError):
        return build_memo_fragment_rule_based(state, evaluation)

    # Normalize structure
    hook = memo.get("hook") or ""
    signal_summary = memo.get("signal_summary")
    if not isinstance(signal_summary, list):
        signal_summary = build_signal_summary_bullets(state)
    red_flags = memo.get("red_flags")
    if not isinstance(red_flags, list):
        red_flags = red_flags_list
    rec = memo.get("recommendation") or {}
    priority = (rec.get("priority") or "").strip() or score_to_priority(
        evaluation.get("score", 5), evaluation.get("recommendation") or "refer_out"
    )
    if priority not in ("High", "Medium", "Low"):
        priority = score_to_priority(evaluation.get("score", 5), evaluation.get("recommendation") or "refer_out")
    next_step = (rec.get("next_step") or "").strip() or get_suggested_next_step(
        priority, evaluation.get("recommendation") or "refer_out"
    )

    return {
        "hook": hook[:500],
        "signal_summary": signal_summary[:15],
        "red_flags": red_flags[:15],
        "recommendation": {
            "priority": priority,
            "next_step": next_step[:200],
        },
    }


# =============================================================================
# Rule-based fallback (no LLM)
# =============================================================================

def build_memo_fragment_rule_based(
    state: Dict[str, Any],
    evaluation: Dict[str, Any],
) -> Dict[str, Any]:
    """Build memo fragment from rules only (no API call)."""
    score = evaluation.get("score", 5)
    recommendation = evaluation.get("recommendation") or "refer_out"
    rationale = evaluation.get("rationale") or []
    signals = state.get("concrete_signals") or {}
    traction = signals.get("traction") or []
    credentials = signals.get("credentials") or []

    # Hook
    if rationale and isinstance(rationale[0], str) and len(rationale[0]) > 20:
        hook = rationale[0][:200].rstrip() + ("..." if len(rationale[0]) > 200 else "")
    else:
        parts = []
        if credentials:
            parts.append("Strong credentials")
        if traction:
            parts.append("concrete traction")
        hook = "Worth a look: " + " and ".join(parts) + "." if parts else (evaluation.get("recommendation_text") or "Review conversation.")[:200]

    priority = score_to_priority(score, recommendation)
    next_step = get_suggested_next_step(priority, recommendation)

    return {
        "hook": hook,
        "signal_summary": build_signal_summary_bullets(state),
        "red_flags": build_red_flags(state, evaluation),
        "recommendation": {
            "priority": priority,
            "next_step": next_step,
        },
    }


# =============================================================================
# Public API
# =============================================================================

def build_memo_fragment(
    state: Dict[str, Any],
    evaluation: Dict[str, Any],
    api_key: Optional[str] = None,
    persona_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build structured Investment Memo Fragment (Analyst Memo).
    When api_key and persona_name are provided, uses LLM for tenant-aware memo.
    Otherwise uses rule-based fallback.
    Returns:
        hook: One-sentence why this founder stands out (or doesn’t).
        signal_summary: Bulleted list of traction/credentials.
        red_flags: AI-detection or behavioral anomalies.
        recommendation: { priority: High|Medium|Low, next_step: e.g. "Schedule 15m Intro" }.
    """
    if api_key and (api_key or "").strip().startswith("sk-") and persona_name:
        try:
            return generate_memo_fragment_llm(api_key, state, evaluation, persona_name)
        except Exception:
            pass
    return build_memo_fragment_rule_based(state, evaluation)


# Backwards compatibility: verdict -> recommendation.priority
def score_to_verdict(score: int, recommendation: str) -> str:
    """Map to High/Medium/Low (alias for score_to_priority)."""
    return score_to_priority(score, recommendation)
