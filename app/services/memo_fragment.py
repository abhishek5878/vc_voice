"""
Investment Memo Fragment generator.
Builds a structured fragment (hook, red_flags, verdict) from triage state and evaluation.
"""

from typing import Any, Dict, List


def score_to_verdict(score: int, recommendation: str) -> str:
    """Map evaluation score/recommendation to High/Medium/Low priority."""
    if recommendation == "recommend_meeting" or score >= 8:
        return "High"
    if recommendation == "recommend_if_bandwidth" or (score >= 6 and score < 8):
        return "Medium"
    return "Low"


def build_red_flags(
    state: Dict[str, Any],
    evaluation: Dict[str, Any],
) -> List[str]:
    """Collect AI-detection and behavioral anomalies from the conversation."""
    flags: List[str] = []

    # AI detection
    cumulative_ai = state.get("cumulative_ai_score") or 0
    if cumulative_ai >= 0.6:
        flags.append(f"High AI probability ({cumulative_ai:.2f})")
    elif cumulative_ai >= 0.4:
        flags.append(f"Moderate AI signals ({cumulative_ai:.2f})")

    for d in state.get("ai_detection_history", []):
        for f in d.get("flags", [])[:3]:  # cap per turn
            if f and f not in flags:
                flags.append(f)

    # Behavioral
    for b in state.get("behavioral_history", []):
        if b.get("evasion_flag"):
            flags.append("Evasive or non-specific response")
        for rf in b.get("red_flags", []):
            if rf and rf not in flags:
                flags.append(rf)

    # Hardcoded rejection reason
    if state.get("hardcoded_rejection") and state.get("hardcoded_rejection_reason"):
        flags.append(state["hardcoded_rejection_reason"])

    # Scoring factors from evaluation
    for factor in evaluation.get("scoring_factors", [])[:5]:
        if factor and factor not in flags:
            flags.append(factor)

    return flags[:15]  # cap total


def build_the_hook(
    state: Dict[str, Any],
    evaluation: Dict[str, Any],
) -> str:
    """One sentence on why this founder is worth a look (from signals + rationale)."""
    rationale = evaluation.get("rationale") or []
    signals = state.get("concrete_signals") or {}
    traction = signals.get("traction") or []
    credentials = signals.get("credentials") or []

    parts: List[str] = []
    if credentials:
        parts.append("Strong credentials")
    if traction:
        parts.append("concrete traction")
    if rationale:
        first = rationale[0] if isinstance(rationale[0], str) else str(rationale[0])
        if len(first) > 20:
            return first[:200].rstrip() + ("..." if len(first) > 200 else "")

    if parts:
        return "Worth a look: " + " and ".join(parts) + "."
    rec = evaluation.get("recommendation_text") or ""
    return rec[:200] if rec else "Review conversation for context."


def build_memo_fragment(
    state: Dict[str, Any],
    evaluation: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Build structured Investment Memo Fragment from conversation state and evaluation.
    Returns dict with: hook, red_flags, verdict (High/Medium/Low).
    """
    score = evaluation.get("score", 5)
    recommendation = evaluation.get("recommendation") or "refer_out"

    return {
        "hook": build_the_hook(state, evaluation),
        "red_flags": build_red_flags(state, evaluation),
        "verdict": score_to_verdict(score, recommendation),
    }
