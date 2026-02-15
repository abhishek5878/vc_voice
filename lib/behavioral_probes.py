"""
PI Triage System - Behavioral Authenticity Probes
Detects AI-polished responses through asymmetric questions and response analysis.
"""

import re
from typing import Dict, List, Tuple, Any
from .config import BEHAVIORAL


# ============================================================================
# Evasion Detection
# ============================================================================

EVASION_PATTERNS = [
    # Deflection to generalities
    r"(?:generally speaking|in general|typically|usually|often)",
    # Avoiding direct answer
    r"(?:it depends|there are many factors|multiple reasons)",
    # Circular reference
    r"(?:as i mentioned|as stated|as noted|like i said)",
    # Topic pivot without answering
    r"(?:what's more important is|the real question is|let me instead)",
    # Vague acknowledgment
    r"(?:that's a good question|interesting question|great point)",
    # Non-answer qualifiers
    r"(?:in a way|sort of|kind of|more or less)",
]

DIRECT_ANSWER_INDICATORS = [
    # Specific numbers
    r"\d+\s*(?:customers?|users?|%|percent|months?|years?|weeks?|cr|lakh|L|k|K|M)",
    # Specific dates/times
    r"(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4}",
    r"(?:q[1-4])\s*\d{4}",
    r"\d{4}",
    # Specific names/entities
    r"(?:we|i)\s+(?:tried|built|launched|shipped|raised|hired|fired|pivoted)",
    # First person ownership
    r"(?:i|we)\s+(?:decided|chose|realized|learned|failed|succeeded|discovered)",
]


def detect_evasion(text: str, question_context: str = "") -> Tuple[bool, List[str]]:
    """
    Detect if a response evades the question.

    Returns:
        (is_evasive, detected_patterns)
    """
    text_lower = text.lower()
    evasion_flags = []
    direct_flags = []

    # Check for evasion patterns
    for pattern in EVASION_PATTERNS:
        if re.search(pattern, text_lower):
            evasion_flags.append(pattern)

    # Check for direct answer indicators
    for pattern in DIRECT_ANSWER_INDICATORS:
        if re.search(pattern, text_lower):
            direct_flags.append(pattern)

    # If many evasion patterns and few direct indicators, likely evasive
    evasion_score = len(evasion_flags) - (len(direct_flags) * 0.5)

    is_evasive = evasion_score >= 1.5 or (len(evasion_flags) >= 2 and len(direct_flags) == 0)

    return is_evasive, evasion_flags


# ============================================================================
# Specificity Scoring
# ============================================================================

SPECIFICITY_INDICATORS = {
    # High specificity (weight 1.0)
    "high": [
        r"\d+\s*(?:customers?|users?|paying)",  # Customer counts
        r"(?:\$|₹|rs\.?)\s*\d+[kKmMlLcC]?",  # Revenue figures
        r"\d+(?:\.\d+)?%",  # Percentages
        r"(?:q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december)\s*(?:20\d{2})?",  # Dates
        r"(?:raised|funding)\s*(?:\$|₹)?\d+",  # Funding
        r"\d+\s*(?:months?|years?|weeks?|days?)",  # Time durations
        r"(?:cac|ltv|arpu|mrr|arr|nps|dau|mau|wau)",  # Metrics
    ],
    # Medium specificity (weight 0.5)
    "medium": [
        r"(?:we|i)\s+(?:built|launched|shipped|tried|tested)",  # Action verbs
        r"(?:first|second|third|initial|early)\s+(?:version|iteration|attempt)",  # Iterations
        r"(?:because|since|due to|reason was)",  # Causal explanations
        r"(?:specifically|exactly|precisely)",  # Specificity markers
    ],
    # Low specificity (weight 0.0)
    "low": [
        r"(?:some|many|several|various|multiple)\s+(?:customers?|users?|people)",
        r"(?:significant|substantial|considerable)\s+(?:growth|traction|progress)",
        r"(?:innovative|cutting-edge|unique|revolutionary)",
        r"(?:leverage|synergy|optimize|streamline)",
    ],
}


def calculate_specificity_score(text: str) -> Tuple[float, Dict[str, int]]:
    """
    Calculate specificity score for a response.

    Returns:
        (score 0-1, breakdown by category)
    """
    text_lower = text.lower()
    counts = {"high": 0, "medium": 0, "low": 0}

    for category, patterns in SPECIFICITY_INDICATORS.items():
        for pattern in patterns:
            matches = re.findall(pattern, text_lower)
            counts[category] += len(matches)

    # Calculate weighted score
    # High specificity is good, low specificity is bad
    positive_signals = counts["high"] * 1.0 + counts["medium"] * 0.5
    negative_signals = counts["low"] * 0.3

    # Normalize to 0-1
    raw_score = positive_signals - negative_signals

    # Map to 0-1 range (assuming max useful score around 5)
    score = min(1.0, max(0.0, raw_score / 5.0))

    return score, counts


# ============================================================================
# Temporal Grounding Detection
# ============================================================================

TEMPORAL_PATTERNS = [
    # Specific dates
    r"(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*(?:20\d{2})?",
    r"(?:q[1-4])\s*(?:20\d{2})?",
    r"(?:early|mid|late)\s*20\d{2}",
    r"20\d{2}",
    # Relative time with specifics
    r"\d+\s*(?:months?|years?|weeks?|days?)\s+ago",
    r"(?:last|this|next)\s+(?:month|year|week|quarter)",
    r"(?:since|before|after)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)",
    # Sequential markers
    r"(?:first|then|after that|next|finally|initially|eventually)",
]

VAGUE_TEMPORAL_PATTERNS = [
    r"(?:recently|soon|eventually|sometime|at some point)",
    r"(?:in the past|in the future|going forward)",
    r"(?:for a while|for some time)",
]


def detect_temporal_grounding(text: str) -> Tuple[bool, List[str], List[str]]:
    """
    Detect if response includes temporal grounding.

    Returns:
        (has_grounding, specific_markers, vague_markers)
    """
    text_lower = text.lower()
    specific_markers = []
    vague_markers = []

    for pattern in TEMPORAL_PATTERNS:
        matches = re.findall(pattern, text_lower)
        specific_markers.extend(matches)

    for pattern in VAGUE_TEMPORAL_PATTERNS:
        matches = re.findall(pattern, text_lower)
        vague_markers.extend(matches)

    # Has grounding if specific markers outweigh vague ones
    has_grounding = len(specific_markers) > len(vague_markers) and len(specific_markers) >= 1

    return has_grounding, specific_markers, vague_markers


# ============================================================================
# Main Behavioral Analysis
# ============================================================================

def analyze_behavioral_response(
    text: str,
    question_type: str = "",
    previous_context: str = ""
) -> Dict[str, Any]:
    """
    Full behavioral analysis of a user response.

    Returns:
        {
            "specificity_score": float (0-1),
            "evasion_flag": bool,
            "temporal_grounding": bool,
            "red_flags": List[str],
            "positive_signals": List[str],
            "details": Dict with breakdown
        }
    """
    red_flags = []
    positive_signals = []

    # Evasion detection
    is_evasive, evasion_patterns = detect_evasion(text, previous_context)
    if is_evasive:
        red_flags.append("Response appears evasive")

    # Specificity scoring
    specificity_score, specificity_breakdown = calculate_specificity_score(text)
    if specificity_score < 0.2:
        red_flags.append("Low specificity - lacks concrete details")
    elif specificity_score > 0.6:
        positive_signals.append("High specificity - includes concrete details")

    # Temporal grounding
    has_temporal, specific_temporal, vague_temporal = detect_temporal_grounding(text)
    if has_temporal:
        positive_signals.append("Includes temporal grounding")
    elif len(vague_temporal) > len(specific_temporal):
        red_flags.append("Uses vague temporal references")

    # Check for short, dismissive responses
    if len(text) < 50:
        red_flags.append("Very short response")

    # Check for excessive length (might be AI padding)
    if len(text) > 1500:
        red_flags.append("Excessively long response")

    return {
        "specificity_score": round(specificity_score, 3),
        "evasion_flag": is_evasive,
        "temporal_grounding": has_temporal,
        "red_flags": red_flags,
        "positive_signals": positive_signals,
        "details": {
            "evasion_patterns": evasion_patterns,
            "specificity_breakdown": specificity_breakdown,
            "temporal_specific": specific_temporal[:5],  # Limit for size
            "temporal_vague": vague_temporal[:5],
            "text_length": len(text),
        }
    }


def calculate_behavioral_penalty(
    behavioral_history: List[Dict[str, Any]],
    cumulative_ai_score: float
) -> float:
    """
    Calculate penalty to add to AI score based on behavioral analysis.

    Returns:
        Penalty value to add to cumulative_ai_score
    """
    if not behavioral_history:
        return 0.0

    penalty = 0.0

    # Count red flags across all turns
    total_red_flags = sum(len(b.get("red_flags", [])) for b in behavioral_history)
    penalty += total_red_flags * BEHAVIORAL["behavioral_penalty_multiplier"]

    # Additional penalty for consistent evasion
    evasion_count = sum(1 for b in behavioral_history if b.get("evasion_flag", False))
    if evasion_count >= 2:
        penalty += 0.2

    return penalty


def should_cap_for_behavioral(
    behavioral_history: List[Dict[str, Any]],
    cumulative_ai_score: float
) -> Tuple[bool, int, str]:
    """
    Determine if score should be capped based on behavioral analysis.

    Returns:
        (should_cap, max_score, reason)
    """
    if not behavioral_history:
        return False, 10, ""

    # Count evasions
    evasion_count = sum(1 for b in behavioral_history if b.get("evasion_flag", False))

    # Calculate average specificity
    specificities = [b.get("specificity_score", 0.5) for b in behavioral_history]
    avg_specificity = sum(specificities) / len(specificities) if specificities else 0.5

    # Rule 1: Too many evasions
    if evasion_count >= BEHAVIORAL["evasion_rejection_count"]:
        return True, BEHAVIORAL["evasion_rejection_score"], f"Too many evasive responses ({evasion_count})"

    # Rule 2: Low specificity + moderate AI score
    if (avg_specificity < BEHAVIORAL["low_specificity_threshold"] and
        cumulative_ai_score >= BEHAVIORAL["low_specificity_ai_threshold"]):
        return True, BEHAVIORAL["low_specificity_score"], "Low specificity combined with AI signals"

    return False, 10, ""


def get_behavioral_probe_suggestion(
    behavioral_history: List[Dict[str, Any]],
    turn_count: int
) -> str:
    """
    Suggest what type of probe to use based on behavioral history.

    Returns probe type: "owned_failure", "temporal_anchoring", "tradeoff_reasoning", "personal_causality"
    """
    if not behavioral_history:
        return "owned_failure"  # Start with failure probe

    latest = behavioral_history[-1]

    # If lacking temporal grounding, ask temporal question
    if not latest.get("temporal_grounding", False):
        return "temporal_anchoring"

    # If being evasive, ask personal causality (harder to evade)
    if latest.get("evasion_flag", False):
        return "personal_causality"

    # If low specificity, ask for tradeoffs (requires concrete thinking)
    if latest.get("specificity_score", 0.5) < 0.3:
        return "tradeoff_reasoning"

    # Rotate through probe types based on turn
    probe_types = ["owned_failure", "temporal_anchoring", "tradeoff_reasoning", "personal_causality"]
    return probe_types[turn_count % len(probe_types)]
