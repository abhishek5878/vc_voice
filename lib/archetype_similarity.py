"""
PI Triage System - Archetype Similarity Detection
Detects repeated low-signal patterns using embedding similarity.
"""

import json
import os
import math
from typing import Dict, List, Tuple, Any, Optional
from .config import ARCHETYPE, get_data_path


# ============================================================================
# Low-Signal Archetypes (Initial List)
# ============================================================================

DEFAULT_ARCHETYPES = [
    {
        "id": "ai_for_x",
        "pattern": "AI solution for [industry]",
        "examples": [
            "AI-powered solution for healthcare",
            "AI platform for education",
            "AI tool for HR and recruitment",
            "AI assistant for customer service",
            "Machine learning solution for retail",
            "AI-driven analytics for finance",
        ],
        "why_low_signal": "Generic AI positioning without specific problem or differentiation",
    },
    {
        "id": "marketplace_for_y",
        "pattern": "Marketplace for [category]",
        "examples": [
            "Marketplace for freelancers",
            "Platform connecting buyers and sellers",
            "Two-sided marketplace for services",
            "Marketplace for local businesses",
            "Online marketplace for handmade goods",
        ],
        "why_low_signal": "Marketplaces require massive capital and network effects, rarely work for first-time founders",
    },
    {
        "id": "uber_for_z",
        "pattern": "Uber for [service]",
        "examples": [
            "Uber for laundry",
            "Uber for groceries",
            "On-demand [service] platform",
            "Uber but for [category]",
            "Airbnb for [category]",
        ],
        "why_low_signal": "Copy-paste business model without understanding unit economics",
    },
    {
        "id": "generic_saas",
        "pattern": "B2B SaaS to help companies [verb]",
        "examples": [
            "B2B platform to help companies manage operations",
            "SaaS solution for enterprise productivity",
            "Cloud platform for business automation",
            "Software to streamline workflows",
            "Platform to optimize business processes",
        ],
        "why_low_signal": "Too broad, no clear ICP or specific problem",
    },
    {
        "id": "vague_fintech",
        "pattern": "Financial [solution] for [underserved]",
        "examples": [
            "Financial inclusion solution for underserved",
            "Fintech for the unbanked",
            "Digital payments for rural India",
            "Credit solution for underserved segments",
            "Financial services for the next billion",
        ],
        "why_low_signal": "Noble goal but typically naive about regulatory and distribution challenges",
    },
    {
        "id": "student_advice_seeking",
        "pattern": "Student seeking career/startup advice",
        "examples": [
            "I'm a student interested in startups",
            "Looking for mentorship and guidance",
            "Want to learn about venture capital",
            "Seeking advice on career in tech",
            "Student exploring entrepreneurship",
        ],
        "why_low_signal": "Generic mentorship requests without specific, actionable questions",
    },
    {
        "id": "networking_request",
        "pattern": "General networking request",
        "examples": [
            "Would love to connect and pick your brain",
            "Reaching out to expand my network",
            "Want to learn from your experience",
            "Coffee chat to discuss the ecosystem",
            "Interested in your insights on [broad topic]",
        ],
        "why_low_signal": "No specific value exchange, pure time extraction",
    },
    {
        "id": "generic_edtech",
        "pattern": "EdTech platform for [learning]",
        "examples": [
            "Online learning platform",
            "EdTech solution for skill development",
            "Platform for online courses",
            "Educational technology for students",
            "Learning management system",
        ],
        "why_low_signal": "Crowded space, difficult unit economics, distribution challenges",
    },
]


# ============================================================================
# Vector Operations
# ============================================================================

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if len(vec1) != len(vec2):
        return 0.0

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot_product / (norm1 * norm2)


# ============================================================================
# Archetype Storage
# ============================================================================

def load_rejected_archetypes() -> List[Dict[str, Any]]:
    """Load rejected archetypes from storage."""
    path = get_data_path("rejected_archetypes.json")
    try:
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return []


def save_rejected_archetype(
    archetype_id: str,
    pitch_text: str,
    embedding: List[float],
    rejection_reason: str
) -> None:
    """Add a new rejected archetype to storage."""
    path = get_data_path("rejected_archetypes.json")

    archetypes = load_rejected_archetypes()

    archetypes.append({
        "id": archetype_id,
        "pitch_text": pitch_text[:500],  # Truncate for storage
        "embedding": embedding,
        "rejection_reason": rejection_reason,
    })

    # Limit storage size
    if len(archetypes) > 1000:
        archetypes = archetypes[-1000:]

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(archetypes, f)


# ============================================================================
# Pattern Matching (Without Embeddings)
# ============================================================================

def check_keyword_archetype_match(text: str) -> Tuple[Optional[str], float, str]:
    """
    Quick keyword-based archetype matching (no API call needed).

    Returns:
        (matched_archetype_id, confidence, reason)
    """
    text_lower = text.lower()

    # Check for "AI for X" pattern
    if ("ai" in text_lower or "artificial intelligence" in text_lower or
        "machine learning" in text_lower or "ml" in text_lower):
        generic_words = ["solution", "platform", "tool", "powered", "driven", "based"]
        if any(w in text_lower for w in generic_words):
            industry_words = ["healthcare", "education", "hr", "finance", "retail",
                           "customer service", "business", "enterprise"]
            if any(w in text_lower for w in industry_words):
                return "ai_for_x", 0.8, "Generic AI + industry pattern detected"

    # Check for marketplace pattern
    if "marketplace" in text_lower or "two-sided" in text_lower:
        return "marketplace_for_y", 0.7, "Marketplace pattern detected"

    # Check for "Uber for X" pattern
    uber_patterns = ["uber for", "airbnb for", "netflix for", "amazon for",
                    "on-demand", "on demand"]
    if any(p in text_lower for p in uber_patterns):
        return "uber_for_z", 0.7, "Uber-for-X pattern detected"

    # Check for generic SaaS
    saas_patterns = ["b2b platform", "saas solution", "enterprise software",
                    "streamline operations", "optimize processes", "business automation"]
    if any(p in text_lower for p in saas_patterns):
        return "generic_saas", 0.6, "Generic SaaS pattern detected"

    # Check for vague fintech
    fintech_patterns = ["financial inclusion", "unbanked", "underserved",
                       "next billion", "rural india", "digital payments"]
    if any(p in text_lower for p in fintech_patterns):
        if not any(specific in text_lower for specific in
                  ["customers", "revenue", "mrr", "users", "transactions"]):
            return "vague_fintech", 0.6, "Vague fintech pattern without traction"

    # Check for student advice seeking
    student_patterns = ["student", "studying", "career advice", "mentorship",
                       "guidance", "learn about startups", "explore entrepreneurship"]
    if any(p in text_lower for p in student_patterns):
        if not any(action in text_lower for action in
                  ["building", "launched", "raised", "customers", "revenue"]):
            return "student_advice_seeking", 0.7, "Student seeking general advice"

    # Check for generic networking
    network_patterns = ["pick your brain", "coffee chat", "expand my network",
                       "connect and learn", "30 minutes of your time", "quick call"]
    if any(p in text_lower for p in network_patterns):
        return "networking_request", 0.8, "Generic networking request"

    # Check for generic edtech
    edtech_patterns = ["online learning", "edtech", "online courses",
                      "skill development", "lms", "learning platform"]
    if any(p in text_lower for p in edtech_patterns):
        if not any(specific in text_lower for specific in
                  ["students enrolled", "revenue", "completion rate", "paying"]):
            return "generic_edtech", 0.6, "Generic EdTech without traction"

    return None, 0.0, ""


# ============================================================================
# Embedding-Based Matching
# ============================================================================

async def check_embedding_similarity(
    text: str,
    embedding: List[float],
    rejected_archetypes: List[Dict[str, Any]]
) -> Tuple[float, Optional[str], str]:
    """
    Compare pitch embedding against rejected archetypes.

    Returns:
        (max_similarity, matched_archetype_id, reason)
    """
    if not rejected_archetypes or not embedding:
        return 0.0, None, ""

    max_similarity = 0.0
    matched_id = None
    matched_reason = ""

    for archetype in rejected_archetypes:
        arch_embedding = archetype.get("embedding", [])
        if not arch_embedding:
            continue

        similarity = cosine_similarity(embedding, arch_embedding)

        if similarity > max_similarity:
            max_similarity = similarity
            matched_id = archetype.get("id", "unknown")
            matched_reason = archetype.get("rejection_reason", "Similar to rejected pattern")

    return max_similarity, matched_id, matched_reason


# ============================================================================
# Main Analysis Function
# ============================================================================

def analyze_archetype(
    text: str,
    embedding: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Full archetype analysis combining keyword and embedding matching.

    Returns:
        {
            "keyword_match": {
                "archetype_id": str or None,
                "confidence": float,
                "reason": str
            },
            "embedding_match": {
                "max_similarity": float,
                "archetype_id": str or None,
                "reason": str
            },
            "combined_assessment": {
                "is_low_signal": bool,
                "archetype_id": str or None,
                "confidence": float,
                "action": str  # "reject", "downgrade", "none"
            }
        }
    """
    result = {
        "keyword_match": {
            "archetype_id": None,
            "confidence": 0.0,
            "reason": ""
        },
        "embedding_match": {
            "max_similarity": 0.0,
            "archetype_id": None,
            "reason": ""
        },
        "combined_assessment": {
            "is_low_signal": False,
            "archetype_id": None,
            "confidence": 0.0,
            "action": "none"
        }
    }

    # Step 1: Keyword matching (fast, no API)
    kw_id, kw_conf, kw_reason = check_keyword_archetype_match(text)
    result["keyword_match"] = {
        "archetype_id": kw_id,
        "confidence": kw_conf,
        "reason": kw_reason
    }

    # Step 2: Embedding matching (if embedding provided)
    if embedding:
        rejected_archetypes = load_rejected_archetypes()
        if rejected_archetypes:
            # Note: This is synchronous for simplicity
            # In production, use async
            max_sim = 0.0
            matched_id = None
            matched_reason = ""

            for archetype in rejected_archetypes:
                arch_embedding = archetype.get("embedding", [])
                if arch_embedding:
                    similarity = cosine_similarity(embedding, arch_embedding)
                    if similarity > max_sim:
                        max_sim = similarity
                        matched_id = archetype.get("id")
                        matched_reason = archetype.get("rejection_reason", "")

            result["embedding_match"] = {
                "max_similarity": round(max_sim, 4),
                "archetype_id": matched_id,
                "reason": matched_reason
            }

    # Step 3: Combined assessment
    # Use highest confidence signal
    kw_signal = result["keyword_match"]["confidence"]
    emb_signal = result["embedding_match"]["max_similarity"]

    if emb_signal >= ARCHETYPE["immediate_rejection_similarity"]:
        result["combined_assessment"] = {
            "is_low_signal": True,
            "archetype_id": result["embedding_match"]["archetype_id"],
            "confidence": emb_signal,
            "action": "reject"
        }
    elif emb_signal >= ARCHETYPE["downgrade_similarity"]:
        result["combined_assessment"] = {
            "is_low_signal": True,
            "archetype_id": result["embedding_match"]["archetype_id"],
            "confidence": emb_signal,
            "action": "downgrade"
        }
    elif kw_signal >= 0.7:
        result["combined_assessment"] = {
            "is_low_signal": True,
            "archetype_id": result["keyword_match"]["archetype_id"],
            "confidence": kw_signal,
            "action": "downgrade"
        }
    elif kw_signal >= 0.5:
        result["combined_assessment"] = {
            "is_low_signal": True,
            "archetype_id": result["keyword_match"]["archetype_id"],
            "confidence": kw_signal,
            "action": "warn"
        }

    return result


def get_archetype_penalty(analysis: Dict[str, Any]) -> int:
    """
    Get quality score penalty based on archetype analysis.

    Returns penalty to subtract from quality score.
    """
    action = analysis.get("combined_assessment", {}).get("action", "none")

    if action == "reject":
        return 10  # Effectively reject
    elif action == "downgrade":
        return ARCHETYPE["downgrade_penalty"]
    elif action == "warn":
        return 1

    return 0
