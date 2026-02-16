"""
PI Triage System - Configuration
All thresholds, constants, and settings.
"""

import os
from typing import Dict, Any

# ============================================================================
# API Configuration
# ============================================================================

OPENAI_MODEL = "gpt-3.5-turbo"
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
OPENAI_TIMEOUT = 20  # seconds (Vercel limit)
OPENAI_MAX_RETRIES = 2

# ============================================================================
# Conversation Settings
# ============================================================================

MIN_TURNS_FOR_EVALUATION = 4
MAX_TURNS = 7
FORCE_EVALUATION_TURN = 7

# ============================================================================
# AI Detection Thresholds
# ============================================================================

AI_DETECTION = {
    # Phrase detection scoring
    "phrase_low_count": 2,      # 1-2 phrases
    "phrase_low_score": 0.3,
    "phrase_high_count": 3,     # 3+ phrases
    "phrase_high_score": 1.0,

    # Structure detection
    "structure_marker_threshold": 3,
    "structure_score": 1.0,

    # Length detection
    "length_high_chars": 1500,
    "length_high_score": 0.8,
    "length_medium_chars": 1000,
    "length_medium_score": 0.4,

    # Pattern detection
    "pattern_score_each": 0.2,

    # Cumulative scoring weights
    "cumulative_previous_weight": 0.6,
    "cumulative_current_weight": 0.4,

    # Hard rejection thresholds
    "immediate_rejection_threshold": 0.7,
    "cap_score_threshold": 0.5,
    "cap_score_value": 2,
    "reject_no_signals_threshold": 0.6,
    "reject_no_signals_turn": 3,
}

# ============================================================================
# Behavioral Analysis Thresholds
# ============================================================================

BEHAVIORAL = {
    "evasion_rejection_count": 3,
    "evasion_rejection_score": 2,
    "low_specificity_threshold": 0.05,
    "low_specificity_ai_threshold": 0.4,
    "low_specificity_score": 4,
    "behavioral_penalty_multiplier": 0.15,
}

# ============================================================================
# Signal Extraction Settings
# ============================================================================

SIGNALS = {
    "strong_signal_count": 3,  # >= 3 signals by turn 3 = strong positive
    "no_signals_ai_threshold": 0.6,  # no signals + high AI = reject
}

# ============================================================================
# Archetype Similarity Thresholds
# ============================================================================

ARCHETYPE = {
    "immediate_rejection_similarity": 0.96,
    "downgrade_similarity": 0.92,
    "downgrade_penalty": 2,
}

# ============================================================================
# Scoring Settings
# ============================================================================

SCORING = {
    # Authenticity score thresholds (slightly relaxed so founders can describe startup before harsh cap)
    "auth_immediate_reject_ai": 0.75,
    "auth_immediate_reject_score": 1,
    "auth_cap_ai": 0.55,
    "auth_cap_score": 3,
    "auth_warn_ai": 0.35,
    "auth_warn_score": 5,

    # Quality score adjustments
    "signal_boost_count": 3,
    "signal_boost_value": 1,

    # Recommendation thresholds
    "do_not_recommend_threshold": 4,
    "refer_out_threshold": 6,
    "recommend_if_bandwidth_threshold": 7,
}

# ============================================================================
# Classification Keywords
# ============================================================================

CLASSIFICATION = {
    "founder_keywords": [
        "building", "co-founder", "cofounder", "founder", "raised",
        "startup", "bootstrapped", "launched", "started", "ceo", "cto"
    ],
    "student_keywords": [
        "studying", "student", "learning", "university", "college",
        "pursuing", "graduating", "undergraduate", "graduate", "phd"
    ],
    "operator_keywords": [
        "working at", "employee", "joined", "work at", "engineer at",
        "manager at", "lead at", "director at"
    ],
    "partnership_keywords": [
        "partnership", "collaborate", "opportunity", "offer", "proposal",
        "business development", "sales", "vendor", "service provider"
    ],
    # Email domains
    "indian_student_domains": [".ac.in"],
    "us_student_domains": [".edu"],
    # Known tech companies (partial list)
    "tech_company_domains": [
        "google.com", "meta.com", "facebook.com", "amazon.com", "microsoft.com",
        "apple.com", "netflix.com", "razorpay.com", "zerodha.com", "flipkart.com",
        "swiggy.com", "zomato.com", "phonepe.com", "paytm.com", "ola.com"
    ],
}

# ============================================================================
# File Paths
# ============================================================================

def get_data_path(filename: str) -> str:
    """Get absolute path to a data file."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, "data", filename)

DATA_FILES = {
    "contacts": "contacts.json",
    "ai_phrases": "ai_phrases.json",
    "rejected_archetypes": "rejected_archetypes.json",
    "personal_background": "personal_background.json",
    "startup_advice": "startup_advice.json",
    "india_ecosystem": "india_ecosystem.json",
    "portfolio_investments": "portfolio_investments.json",
    "pitching_guide": "pitching_guide.json",
}

# ============================================================================
# System Info
# ============================================================================

SYSTEM_VERSION = "1.0.0"
SYSTEM_NAME = "Personal Intelligence Triage"
