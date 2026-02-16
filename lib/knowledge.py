"""
PI Triage System - Knowledge Base Loader
Loads and provides access to Sajith's knowledge for contextual responses.
"""

import json
import os
import random
from typing import Dict, List, Any, Optional
from .config import get_data_path


# Cache for loaded knowledge
_knowledge_cache: Dict[str, Any] = {}


def load_json_file(filename: str) -> Dict[str, Any]:
    """Load a JSON file from the data directory."""
    if filename in _knowledge_cache:
        return _knowledge_cache[filename]

    path = get_data_path(filename)
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                _knowledge_cache[filename] = data
                return data
    except Exception as e:
        print(f"Error loading {filename}: {e}")

    return {}


def get_personal_background() -> Dict[str, Any]:
    """Get Sajith's personal background."""
    return load_json_file("personal_background.json")


def get_pmf_knowledge() -> Dict[str, Any]:
    """Get PMF framework knowledge."""
    return load_json_file("pmf_knowledge.json")


def get_quotes() -> Dict[str, Any]:
    """Get Sajith's quotes and wisdom."""
    return load_json_file("quotes_wisdom.json")


def get_vc_insights() -> Dict[str, Any]:
    """Get VC industry insights."""
    return load_json_file("vc_industry_insights.json")


def get_bot_qa_samples() -> Dict[str, Any]:
    """Get sample Q&A in Sajith's voice."""
    return load_json_file("bot_qa_samples.json")


def get_sajith_voice() -> Dict[str, Any]:
    """Get Sajith voice & style guide (phrases to use/avoid, rhythm)."""
    return load_json_file("sajith_voice.json")


# ============================================================================
# Knowledge Extraction Helpers
# ============================================================================

def get_expertise_areas() -> List[str]:
    """Get Sajith's expertise areas."""
    bg = get_personal_background()
    return bg.get("expertise_areas", [])


def get_investment_focus() -> Dict[str, Any]:
    """Get investment focus details."""
    bg = get_personal_background()
    return bg.get("investment_focus", {})


def get_what_sajith_looks_for() -> List[str]:
    """Get what Sajith looks for in founders."""
    bg = get_personal_background()
    return bg.get("what_sajith_looks_for", [])


def get_red_flags() -> List[str]:
    """Get red flags Sajith watches for."""
    bg = get_personal_background()
    return bg.get("red_flags", [])


def get_pmf_framework() -> Dict[str, Any]:
    """Get the PMF framework details."""
    pmf = get_pmf_knowledge()
    return pmf.get("core_framework", {})


def get_random_quote(category: str = None) -> str:
    """Get a random quote from Sajith, optionally by category."""
    quotes = get_quotes()

    if category:
        category_quotes = quotes.get(f"{category}_quotes", [])
        if category_quotes:
            return random.choice(category_quotes)

    # Get all quotes
    all_quotes = []
    for key, value in quotes.items():
        if key.endswith("_quotes") and isinstance(value, list):
            all_quotes.extend(value)

    if all_quotes:
        return random.choice(all_quotes)

    return ""


def get_pmf_signals(business_type: str = "b2b") -> List[str]:
    """Get PMF signals for a business type."""
    pmf = get_pmf_knowledge()
    framework = pmf.get("core_framework", {})
    ppf = framework.get("ppf", {})
    signals = ppf.get("signals", {})
    return signals.get(business_type, signals.get("b2b", []))


def get_india_framework() -> Dict[str, str]:
    """Get India1-2-3 framework."""
    bg = get_personal_background()
    frameworks = bg.get("core_frameworks", {})
    return frameworks.get("india_framework", {})


# ============================================================================
# Context Generation for PI
# ============================================================================

def get_evaluation_context() -> str:
    """Generate context string for evaluation prompts."""
    bg = get_personal_background()

    expertise = ", ".join(bg.get("expertise_areas", [])[:4])
    looks_for = "\n- ".join(bg.get("what_sajith_looks_for", []))
    red_flags = "\n- ".join(bg.get("red_flags", []))

    pmf = get_pmf_framework()
    pmf_formula = pmf.get("formula", "PMF = PPF + MMF")

    return f"""## SAJITH PAI'S EXPERTISE
{expertise}

## PMF FRAMEWORK
{pmf_formula}
- PPF (Product-to-Problem Fit): Does the pain go away when customers use the product?
- MMF (Motion-to-Market Fit): Can they reliably, affordably acquire customers?
- Shorthand: GRUE (Growth with Retention and Unit Economics)

## WHAT SAJITH LOOKS FOR
- {looks_for}

## RED FLAGS
- {red_flags}"""


def get_probing_questions_context() -> str:
    """Get context for generating probing questions."""
    pmf = get_pmf_knowledge()
    framework = pmf.get("core_framework", {})

    ppf_advice = framework.get("ppf", {}).get("advice", "")
    mmf_golden_rule = framework.get("mmf", {}).get("golden_rule", "")

    return f"""## KEY PROBING AREAS (Based on Sajith's PMF Framework)

1. **PPF Validation**: Has the product solved real customer pain?
   - Ask: "What evidence do you have that customers NEED this, not just want it?"
   - Remember: "{ppf_advice}"

2. **MMF Progress**: Can they acquire customers affordably?
   - Ask: "What's your customer acquisition channel? What's your CAC?"
   - Golden rule: "{mmf_golden_rule}"

3. **Unit Economics**: Is there a path to profitability?
   - Ask: "What's your LTV/CAC? Path to CM2+?"
   - Quote: "Getting to CM2+ is a good shorthand for getting to PMF"

4. **Authentic Learning**: Have they learned from failure?
   - Ask: "What assumption turned out to be wrong?"
   - Quote: "Believe what they do, not what they tell"
"""


def get_classification_probes(classification: str) -> List[str]:
    """Get specific probes based on contact classification."""
    probes = {
        "founder": [
            "Where are you on the PPF-MMF journey?",
            "What's your evidence of customer love?",
            "What's your path to CM2+?",
        ],
        "student": [
            "What specific, actionable question do you have?",
            "Have you started building anything, or just exploring?",
            "Why Sajith specifically, versus other VCs or mentors?",
        ],
        "operator": [
            "Are you exploring founding something, or seeking advice for your current role?",
            "What specific problem have you identified from your work?",
            "What unique insight do you have from your experience?",
        ],
        "partnership": [
            "This appears to be a partnership/sales inquiry. Sajith doesn't typically take these.",
            "What specific value would this provide to Blume's portfolio?",
        ],
    }

    return probes.get(classification, probes["founder"])


def is_in_sajith_wheelhouse(text: str) -> tuple:
    """
    Check if the topic is in Sajith's area of expertise.

    Returns:
        (is_relevant, relevance_reason)
    """
    text_lower = text.lower()

    # High relevance keywords
    high_relevance = [
        "pmf", "product market fit", "product-market fit",
        "distribution", "gtm", "go-to-market", "go to market",
        "consumer", "d2c", "b2c", "domestech",
        "smb saas", "b2b marketplace",
        "india", "indian market", "india1", "india2",
        "seed", "early stage", "pre-seed",
        "retention", "cac", "ltv", "unit economics",
        "ppf", "mmf", "customer acquisition",
    ]

    # Medium relevance
    medium_relevance = [
        "startup", "founder", "fundraising", "vc", "venture",
        "saas", "marketplace", "fintech", "edtech",
        "growth", "scaling", "traction",
    ]

    # Low relevance (outside wheelhouse)
    low_relevance = [
        "deep tech", "biotech", "hardware", "climate tech",
        "crypto", "web3", "blockchain", "nft",
        "late stage", "series c", "series d", "ipo",
        "public markets", "hedge fund",
    ]

    # Check high relevance first
    for keyword in high_relevance:
        if keyword in text_lower:
            return True, f"High relevance: {keyword} is core to Sajith's expertise"

    # Check low relevance (negative signal)
    for keyword in low_relevance:
        if keyword in text_lower:
            return False, f"Outside wheelhouse: {keyword} is not Sajith's focus area"

    # Check medium relevance
    for keyword in medium_relevance:
        if keyword in text_lower:
            return True, f"Moderate relevance: {keyword} relates to Sajith's work"

    return True, "Topic relevance unclear - proceed with standard triage"
