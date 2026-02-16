"""
PI Triage System - Dual-Axis Scoring System
Separates authenticity from quality to avoid conflating different dimensions.
"""

from typing import Dict, List, Tuple, Any, Optional
from .config import SCORING, AI_DETECTION, BEHAVIORAL, SIGNALS, ARCHETYPE


# ============================================================================
# Authenticity Score (0-10)
# ============================================================================

def calculate_authenticity_score(
    cumulative_ai_score: float,
    evasion_count: int,
    avg_specificity: float,
    behavioral_red_flags: int = 0,
    concrete_signal_count: int = 0,
) -> Tuple[int, List[str]]:
    """
    Calculate authenticity score based on AI detection and behavioral analysis.

    Measures: Is this a real human with genuine experiences?
    When concrete_signal_count >= 2, we relax low-specificity penalty (early-stage / brief but substantive).
    """
    score = 10
    factors = []

    # AI Detection penalties (most important)
    if cumulative_ai_score >= SCORING["auth_immediate_reject_ai"]:
        score = SCORING["auth_immediate_reject_score"]
        factors.append(f"Very high AI probability ({cumulative_ai_score:.2f})")
        return score, factors  # No further processing needed

    if cumulative_ai_score >= SCORING["auth_cap_ai"]:
        score = min(score, SCORING["auth_cap_score"])
        factors.append(f"High AI probability ({cumulative_ai_score:.2f}) - capped at {SCORING['auth_cap_score']}")

    elif cumulative_ai_score >= SCORING["auth_warn_ai"]:
        score = min(score, SCORING["auth_warn_score"])
        factors.append(f"Moderate AI signals ({cumulative_ai_score:.2f})")

    # Evasion penalties
    if evasion_count >= BEHAVIORAL["evasion_rejection_count"]:
        score = min(score, BEHAVIORAL["evasion_rejection_score"])
        factors.append(f"Too many evasive responses ({evasion_count})")

    elif evasion_count >= 2:
        score = min(score, 5)
        factors.append(f"Multiple evasive responses ({evasion_count})")

    # Low specificity + AI signals penalty
    if (avg_specificity < BEHAVIORAL["low_specificity_threshold"] and
        cumulative_ai_score >= BEHAVIORAL["low_specificity_ai_threshold"]):
        score = min(score, BEHAVIORAL["low_specificity_score"])
        factors.append("Very low specificity combined with AI signals")

    elif avg_specificity < 0.2:
        # Early-stage path: 2+ concrete signals but brief answers – don't over-penalize
        cap = 6 if concrete_signal_count < 2 else 7
        score = min(score, cap)
        factors.append(f"Low specificity in responses ({avg_specificity:.2f})" + ("; relaxed (concrete signals present)" if concrete_signal_count >= 2 else ""))

    # Behavioral red flags
    if behavioral_red_flags >= 5:
        score = min(score, 4)
        factors.append(f"Multiple behavioral red flags ({behavioral_red_flags})")
    elif behavioral_red_flags >= 3:
        score -= 1
        factors.append(f"Some behavioral red flags ({behavioral_red_flags})")

    return max(0, score), factors


# ============================================================================
# Quality Score (0-10)
# ============================================================================

def calculate_quality_score(
    llm_score: int,
    concrete_signal_count: int,
    archetype_similarity: float,
    classification: str,
    has_strong_credentials: bool = False
) -> Tuple[int, List[str]]:
    """
    Calculate quality score based on LLM evaluation and concrete signals.

    Measures: Is this person/idea worth Sajith's time?

    Returns:
        (score 0-10, list of factors affecting score)
    """
    score = llm_score
    factors = []

    # Archetype similarity penalty
    if archetype_similarity >= ARCHETYPE["immediate_rejection_similarity"]:
        score = 1
        factors.append("Too similar to rejected low-signal pattern")
        return score, factors

    if archetype_similarity >= ARCHETYPE["downgrade_similarity"]:
        score = min(score, 4)
        factors.append(f"Similar to known low-signal archetype ({archetype_similarity:.2f})")

    # Signal boost
    if concrete_signal_count >= SCORING["signal_boost_count"]:
        score = min(score + SCORING["signal_boost_value"], 10)
        factors.append(f"Strong concrete signals ({concrete_signal_count})")

    elif concrete_signal_count >= 2:
        factors.append(f"Some concrete signals ({concrete_signal_count})")

    elif concrete_signal_count == 0:
        score = min(score, 6)
        factors.append("No concrete signals detected")

    # Classification-based adjustments
    if classification == "partnership":
        score = min(score, 3)
        factors.append("Partnership/sales outreach - typically low signal")

    if classification == "student" and concrete_signal_count == 0:
        score = min(score, 4)
        factors.append("Student without specific actionable need")

    # Strong credentials boost (cap at +1)
    if has_strong_credentials and score < 10:
        score += 1
        factors.append("Strong credentials detected")

    return max(0, min(10, score)), factors


# ============================================================================
# Final Score Calculation
# ============================================================================

def calculate_final_score(
    authenticity_score: int,
    quality_score: int,
    hardcoded_rejection: bool = False,
    hardcoded_reason: str = ""
) -> Tuple[int, str, List[str]]:
    """
    Calculate final score and recommendation.

    Final score = min(authenticity_score, quality_score)

    Rationale:
    - Authentic but weak → Low score (can't help)
    - Strong but AI-polished → Low score (not genuine)
    - Authentic AND strong → High score (worth meeting)

    Returns:
        (final_score, recommendation, combined_factors)
    """
    factors = []

    # Hardcoded rejection overrides everything
    if hardcoded_rejection:
        return 1, "do_not_recommend", [f"Hardcoded rejection: {hardcoded_reason}"]

    # Final score is the minimum of both axes
    final_score = min(authenticity_score, quality_score)

    # Explain which axis limited the score
    if authenticity_score < quality_score:
        factors.append(f"Score limited by authenticity ({authenticity_score})")
    elif quality_score < authenticity_score:
        factors.append(f"Score limited by quality ({quality_score})")
    else:
        factors.append(f"Both axes aligned at {final_score}")

    # Determine recommendation
    recommendation = get_recommendation(final_score)

    return final_score, recommendation, factors


def get_recommendation(score: int) -> str:
    """Map score to recommendation."""
    if score <= SCORING["do_not_recommend_threshold"]:
        return "do_not_recommend"
    elif score <= SCORING["refer_out_threshold"]:
        return "refer_out"
    elif score <= SCORING["recommend_if_bandwidth_threshold"]:
        return "recommend_if_bandwidth"
    else:
        return "recommend_meeting"


def get_recommendation_text(recommendation: str, score: int) -> str:
    """Get human-readable recommendation text."""
    texts = {
        "do_not_recommend": f"Not recommended (Score: {score}/10). This does not appear to be a good use of Sajith's time.",
        "refer_out": f"Refer out (Score: {score}/10). May be worth connecting with other resources, but not a priority meeting.",
        "recommend_if_bandwidth": f"Consider if bandwidth (Score: {score}/10). Some interesting signals, but not a strong fit. Meeting optional.",
        "recommend_meeting": f"Recommend meeting (Score: {score}/10). Strong signals detected. Worth Sajith's time.",
    }
    return texts.get(recommendation, f"Score: {score}/10")


# ============================================================================
# Full Scoring Pipeline
# ============================================================================

def run_full_scoring(
    cumulative_ai_score: float,
    evasion_count: int,
    avg_specificity: float,
    behavioral_red_flags: int,
    llm_score: int,
    concrete_signal_count: int,
    archetype_similarity: float,
    classification: str,
    hardcoded_rejection: bool = False,
    hardcoded_reason: str = "",
    has_strong_credentials: bool = False
) -> Dict[str, Any]:
    """
    Run the complete scoring pipeline.

    Returns:
        {
            "authenticity_score": int,
            "authenticity_factors": List[str],
            "quality_score": int,
            "quality_factors": List[str],
            "final_score": int,
            "recommendation": str,
            "recommendation_text": str,
            "combined_factors": List[str]
        }
    """
    # Calculate authenticity score (pass concrete_signal_count for early-stage / brief-but-substantive path)
    auth_score, auth_factors = calculate_authenticity_score(
        cumulative_ai_score,
        evasion_count,
        avg_specificity,
        behavioral_red_flags,
        concrete_signal_count=concrete_signal_count,
    )

    # Calculate quality score
    quality_score, quality_factors = calculate_quality_score(
        llm_score,
        concrete_signal_count,
        archetype_similarity,
        classification,
        has_strong_credentials
    )

    # Calculate final score
    final_score, recommendation, combined_factors = calculate_final_score(
        auth_score,
        quality_score,
        hardcoded_rejection,
        hardcoded_reason
    )

    return {
        "authenticity_score": auth_score,
        "authenticity_factors": auth_factors,
        "quality_score": quality_score,
        "quality_factors": quality_factors,
        "final_score": final_score,
        "recommendation": recommendation,
        "recommendation_text": get_recommendation_text(recommendation, final_score),
        "combined_factors": auth_factors + quality_factors + combined_factors
    }


# ============================================================================
# Score Interpretation Helpers
# ============================================================================

def interpret_score(score: int) -> str:
    """Get interpretation of a score."""
    if score <= 2:
        return "Definite no - AI-generated, no substance, or wrong fit"
    elif score <= 4:
        return "Probably no - Vague, weak signals, or too early stage"
    elif score <= 6:
        return "Maybe - Some signals but not compelling"
    elif score <= 7:
        return "Worth considering - Clear value, reasonable fit"
    else:
        return "Strong yes - Exceptional signals, definite fit"


def get_score_color(score: int) -> str:
    """Get color code for score display."""
    if score <= 3:
        return "red"
    elif score <= 5:
        return "orange"
    elif score <= 7:
        return "yellow"
    else:
        return "green"


def should_force_evaluation(
    turn_count: int,
    cumulative_ai_score: float,
    concrete_signal_count: int,
    max_turns: int = 5
) -> Tuple[bool, str]:
    """
    Determine if evaluation should be forced.

    Returns:
        (should_force, reason)
    """
    # Force at max turns
    if turn_count >= max_turns:
        return True, "Maximum turns reached"

    # Force on very high AI score
    if cumulative_ai_score >= 0.8:
        return True, "Very high AI probability - early termination"

    # Force if strong signals and turn 4+
    if turn_count >= 4 and concrete_signal_count >= 4:
        return True, "Strong signals detected - proceeding to evaluation"

    # Force if no signals and high AI by turn 4
    if turn_count >= 4 and concrete_signal_count == 0 and cumulative_ai_score >= 0.5:
        return True, "No signals + high AI probability"

    return False, ""
