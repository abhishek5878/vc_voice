"""
PI Triage System - 5-Layer AI Detection
Detects AI-generated or AI-polished content BEFORE the LLM sees it.
"""

import re
import json
import os
from typing import Dict, List, Tuple, Any
from .config import AI_DETECTION, get_data_path


# ============================================================================
# AI-Tell Phrases (Layer 1)
# ============================================================================

DEFAULT_AI_PHRASES = {
    "generic_openings": [
        "i hope this message finds you well",
        "i wanted to reach out",
        "i'd be happy to",
        "i am reaching out",
        "i am writing to",
        "thank you for your time",
        "thank you for considering",
        "i appreciate you taking the time",
        "i look forward to",
        "please feel free to",
        "don't hesitate to",
        "at your earliest convenience",
    ],
    "corporate_speak": [
        "leverage synergies",
        "value proposition",
        "thought leadership",
        "cutting-edge solutions",
        "innovative approach",
        "comprehensive suite",
        "streamline operations",
        "drive growth",
        "unlock value",
        "actionable insights",
        "best-in-class",
        "end-to-end solution",
        "scalable platform",
        "seamless integration",
        "robust framework",
        "holistic approach",
        "paradigm shift",
        "game-changer",
        "disruptive innovation",
        "synergy",
        "optimize performance",
        "maximize efficiency",
        "strategic alignment",
        "key stakeholders",
        "core competencies",
    ],
    "ai_politeness": [
        "i completely understand",
        "that makes total sense",
        "i really appreciate",
        "that's a great question",
        "thank you for asking",
        "i'd be delighted to",
        "absolutely",
        "certainly",
        "indeed",
        "i understand your concern",
        "you raise an excellent point",
        "that's very insightful",
        "i couldn't agree more",
    ],
    "filler_patterns": [
        "in order to",
        "it is important to note that",
        "it should be noted that",
        "as mentioned earlier",
        "as i mentioned",
        "generally speaking",
        "to be honest",
        "to be frank",
        "at the end of the day",
        "moving forward",
        "going forward",
        "with that being said",
        "that being said",
        "having said that",
        "in terms of",
        "when it comes to",
        "with respect to",
        "in this regard",
        "from a ... perspective",
        "on a ... level",
    ],
    "excessive_hedging": [
        "i believe that",
        "i think that",
        "in my opinion",
        "it seems like",
        "it appears that",
        "arguably",
        "potentially",
        "possibly",
        "perhaps",
        "might be",
        "could be",
        "may be",
    ],
}


def load_ai_phrases() -> Dict[str, List[str]]:
    """Load AI phrases from file or use defaults."""
    try:
        path = get_data_path("ai_phrases.json")
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return DEFAULT_AI_PHRASES


def detect_ai_phrases(text: str) -> Tuple[int, List[str]]:
    """
    Layer 1: Detect AI-tell phrases in text.
    Returns (count, list of detected phrases).
    """
    text_lower = text.lower()
    phrases = load_ai_phrases()
    detected = []

    for category, phrase_list in phrases.items():
        for phrase in phrase_list:
            if phrase.lower() in text_lower:
                detected.append(phrase)

    return len(detected), detected


def score_phrase_detection(phrase_count: int) -> float:
    """Calculate score from phrase detection."""
    if phrase_count >= AI_DETECTION["phrase_high_count"]:
        return AI_DETECTION["phrase_high_score"]
    elif phrase_count >= 1:
        return AI_DETECTION["phrase_low_score"]
    return 0.0


# ============================================================================
# Structure Analysis (Layer 2)
# ============================================================================

STRUCTURE_PATTERNS = [
    # Numbered lists
    (r'^\s*\d+[\.\)]\s+', "numbered_list"),
    (r'\n\s*\d+[\.\)]\s+', "numbered_list"),
    # Bullet points
    (r'^\s*[-•*]\s+', "bullet_point"),
    (r'\n\s*[-•*]\s+', "bullet_point"),
    # Markdown headers
    (r'^#{1,6}\s+', "markdown_header"),
    (r'\n#{1,6}\s+', "markdown_header"),
    # Bold text
    (r'\*\*[^*]+\*\*', "bold_text"),
    (r'__[^_]+__', "bold_text"),
    # Code blocks
    (r'```[\s\S]*?```', "code_block"),
    (r'`[^`]+`', "inline_code"),
]


def detect_structure_patterns(text: str) -> Tuple[int, List[str]]:
    """
    Layer 2: Detect AI formatting patterns.
    Returns (marker count, list of detected pattern types).
    """
    detected = []
    total_count = 0

    for pattern, pattern_type in STRUCTURE_PATTERNS:
        matches = re.findall(pattern, text, re.MULTILINE)
        if matches:
            detected.append(pattern_type)
            total_count += len(matches)

    return total_count, list(set(detected))


def score_structure_detection(marker_count: int) -> float:
    """Calculate score from structure detection."""
    if marker_count >= AI_DETECTION["structure_marker_threshold"]:
        return AI_DETECTION["structure_score"]
    return 0.0


# ============================================================================
# Length Analysis (Layer 3)
# ============================================================================

def detect_length(text: str) -> int:
    """Layer 3: Get character count."""
    return len(text)


def score_length_detection(char_count: int) -> float:
    """Calculate score from length detection."""
    if char_count > AI_DETECTION["length_high_chars"]:
        return AI_DETECTION["length_high_score"]
    elif char_count > AI_DETECTION["length_medium_chars"]:
        return AI_DETECTION["length_medium_score"]
    return 0.0


# ============================================================================
# Pattern Analysis (Layer 4)
# ============================================================================

def detect_perfect_grammar(text: str) -> bool:
    """
    Detect if text has suspiciously perfect grammar.
    Real humans often start sentences lowercase in chat.
    """
    sentences = re.split(r'[.!?]\s+', text.strip())
    if len(sentences) < 3:
        return False

    # Check if all sentences start with capital letters
    capitalized = sum(1 for s in sentences if s and s[0].isupper())
    return capitalized == len(sentences)


def detect_no_contractions(text: str) -> bool:
    """
    Detect if text avoids contractions (too formal).
    AI often uses "I am" instead of "I'm", etc.
    """
    # Common formal patterns that could use contractions
    formal_patterns = [
        r'\bi am\b', r'\bi will\b', r'\bi have\b', r'\bi would\b',
        r'\bit is\b', r'\bthat is\b', r'\bwhat is\b', r'\bthere is\b',
        r'\bdo not\b', r'\bdoes not\b', r'\bdid not\b', r'\bcannot\b',
        r'\bwill not\b', r'\bwould not\b', r'\bcould not\b', r'\bshould not\b',
        r'\bwe are\b', r'\bthey are\b', r'\byou are\b',
    ]

    text_lower = text.lower()
    formal_count = sum(1 for p in formal_patterns if re.search(p, text_lower))

    # If 3+ formal patterns and text is long enough, flag it
    return formal_count >= 3 and len(text) > 200


def detect_repetitive_starters(text: str) -> Tuple[bool, List[str]]:
    """
    Detect repetitive sentence starters.
    AI often starts many sentences the same way.
    """
    sentences = re.split(r'[.!?]\s+', text.strip())
    if len(sentences) < 4:
        return False, []

    # Get first word of each sentence
    starters = []
    for s in sentences:
        words = s.split()
        if words:
            starters.append(words[0].lower())

    # Count occurrences
    from collections import Counter
    counts = Counter(starters)

    # Check if any word appears 3+ times
    repeated = [word for word, count in counts.items() if count >= 3]
    return len(repeated) > 0, repeated


def detect_patterns(text: str) -> Tuple[List[str], int]:
    """
    Layer 4: Detect various AI patterns.
    Returns (list of patterns, count).
    """
    patterns_found = []

    if detect_perfect_grammar(text):
        patterns_found.append("perfect_grammar")

    if detect_no_contractions(text):
        patterns_found.append("no_contractions")

    is_repetitive, repeated_words = detect_repetitive_starters(text)
    if is_repetitive:
        patterns_found.append(f"repetitive_starters:{','.join(repeated_words)}")

    return patterns_found, len(patterns_found)


def score_pattern_detection(pattern_count: int) -> float:
    """Calculate score from pattern detection."""
    return pattern_count * AI_DETECTION["pattern_score_each"]


# ============================================================================
# Cumulative Scoring (Layer 5)
# ============================================================================

def calculate_cumulative_score(previous_score: float, current_score: float) -> float:
    """
    Layer 5: Calculate cumulative AI score across conversation.
    Uses weighted average to track AI probability over time.
    """
    return (
        previous_score * AI_DETECTION["cumulative_previous_weight"] +
        current_score * AI_DETECTION["cumulative_current_weight"]
    )


# ============================================================================
# Main Detection Function
# ============================================================================

def run_ai_detection(text: str, previous_cumulative: float = 0.0) -> Dict[str, Any]:
    """
    Run all 5 layers of AI detection on a message.

    Returns:
        {
            "current_score": float,  # Score for this message (0-1+)
            "cumulative_score": float,  # Running cumulative score
            "flags": List[str],  # Human-readable flags
            "details": {
                "phrases": {"count": int, "detected": List[str]},
                "structure": {"count": int, "types": List[str]},
                "length": {"chars": int},
                "patterns": {"detected": List[str], "count": int}
            },
            "action": str  # "none", "warn", "cap_score", "reject"
        }
    """
    flags = []
    current_score = 0.0

    # Layer 1: Phrase Detection
    phrase_count, phrases_detected = detect_ai_phrases(text)
    phrase_score = score_phrase_detection(phrase_count)
    current_score += phrase_score
    if phrases_detected:
        flags.append(f"AI phrases detected: {len(phrases_detected)}")

    # Layer 2: Structure Analysis
    structure_count, structure_types = detect_structure_patterns(text)
    structure_score = score_structure_detection(structure_count)
    current_score += structure_score
    if structure_types:
        flags.append(f"AI formatting: {', '.join(structure_types)}")

    # Layer 3: Length Analysis
    char_count = detect_length(text)
    length_score = score_length_detection(char_count)
    current_score += length_score
    if char_count > AI_DETECTION["length_medium_chars"]:
        flags.append(f"Unusually long message: {char_count} chars")

    # Layer 4: Pattern Analysis
    patterns_detected, pattern_count = detect_patterns(text)
    pattern_score = score_pattern_detection(pattern_count)
    current_score += pattern_score
    if patterns_detected:
        flags.append(f"AI patterns: {', '.join(patterns_detected)}")

    # Layer 5: Cumulative Scoring
    cumulative_score = calculate_cumulative_score(previous_cumulative, current_score)

    # Determine action based on cumulative score
    action = "none"
    if cumulative_score >= AI_DETECTION["immediate_rejection_threshold"]:
        action = "reject"
        flags.append("HIGH AI PROBABILITY - REJECT")
    elif cumulative_score >= AI_DETECTION["cap_score_threshold"]:
        action = "cap_score"
        flags.append("Moderate AI probability - cap score")
    elif cumulative_score >= 0.3:
        action = "warn"
        flags.append("Some AI signals detected")

    return {
        "current_score": round(current_score, 3),
        "cumulative_score": round(cumulative_score, 3),
        "flags": flags,
        "details": {
            "phrases": {
                "count": phrase_count,
                "detected": phrases_detected[:5],  # Limit for response size
                "score": phrase_score
            },
            "structure": {
                "count": structure_count,
                "types": structure_types,
                "score": structure_score
            },
            "length": {
                "chars": char_count,
                "score": length_score
            },
            "patterns": {
                "detected": patterns_detected,
                "count": pattern_count,
                "score": pattern_score
            }
        },
        "action": action
    }


def should_reject_for_ai(
    cumulative_score: float,
    turn_count: int,
    signal_count: int
) -> Tuple[bool, str]:
    """
    Determine if conversation should be rejected based on AI detection.

    Returns:
        (should_reject, reason)
    """
    # Immediate rejection for very high AI probability
    if cumulative_score >= AI_DETECTION["immediate_rejection_threshold"]:
        return True, "AI probability too high"

    # Reject if high AI + no concrete signals by turn 3
    if (turn_count >= AI_DETECTION["reject_no_signals_turn"] and
        cumulative_score >= AI_DETECTION["reject_no_signals_threshold"] and
        signal_count == 0):
        return True, "High AI probability with no concrete signals"

    return False, ""


def get_ai_detection_response() -> str:
    """Get the PI response when AI is detected."""
    return "This reads like ChatGPT wrote it. Can you answer in your own words, with specific details from your actual experience?"
