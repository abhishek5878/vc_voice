"""
PI Triage System - Concrete Signal Extraction
Extracts verifiable traction and credential signals using regex patterns.
"""

import re
from typing import Dict, List, Tuple, Any


# ============================================================================
# Traction Patterns
# ============================================================================

TRACTION_PATTERNS = [
    # Customer counts
    (r'(\d+[kKmM]?\+?)\s*(paying\s+)?customers?', 'customers', 'customer_count'),
    (r'(\d+[kKmM]?\+?)\s*(active\s+)?users?', 'users', 'user_count'),
    (r'(\d+[kKmM]?\+?)\s*(monthly\s+)?subscribers?', 'subscribers', 'subscriber_count'),

    # Revenue
    (r'(\d+(?:\.\d+)?[kKlLcC][rR]?)\s*(?:mrr|monthly\s+recurring)', 'revenue', 'mrr'),
    (r'(\d+(?:\.\d+)?[kKlLcC][rR]?)\s*(?:arr|annual\s+recurring)', 'revenue', 'arr'),
    (r'[\$₹]\s*(\d+(?:\.\d+)?[kKmMlLcC]?)\s*(?:mrr|arr|revenue)', 'revenue', 'revenue'),
    (r'(\d+(?:\.\d+)?[kKlLcC][rR]?)\s*revenue', 'revenue', 'revenue'),
    (r'revenue\s+(?:of\s+)?[\$₹]?\s*(\d+(?:\.\d+)?[kKmMlLcC]?)', 'revenue', 'revenue'),

    # Funding
    (r'raised\s+[\$₹]?\s*(\d+(?:\.\d+)?[kKmMlLcC][rR]?)', 'funding', 'raised'),
    (r'(\d+(?:\.\d+)?[kKlLcC][rR]?)\s*(?:seed|pre-seed|series\s*[a-z])', 'funding', 'round'),
    (r'(?:seed|pre-seed|series\s*[a-z])\s+(?:of\s+)?[\$₹]?\s*(\d+(?:\.\d+)?[kKmMlLcC]?)', 'funding', 'round'),
    (r'funded\s+by\s+([A-Z][a-zA-Z\s]+(?:Ventures?|Capital|Partners?))', 'funding', 'investor'),

    # Growth metrics
    (r'(\d+[xX])\s*growth', 'growth', 'multiple'),
    (r'(\d+(?:\.\d+)?%)\s*(?:mom|month[\-\s]over[\-\s]month)', 'growth', 'mom_growth'),
    (r'(\d+(?:\.\d+)?%)\s*(?:yoy|year[\-\s]over[\-\s]year)', 'growth', 'yoy_growth'),
    (r'(?:grew|growth)\s+(?:by\s+)?(\d+(?:\.\d+)?%)', 'growth', 'growth_rate'),
    (r'doubled\s+(?:revenue|customers?|users?)', 'growth', 'doubled'),
    (r'tripled\s+(?:revenue|customers?|users?)', 'growth', 'tripled'),

    # Unit economics
    (r'(?:cac|customer\s+acquisition\s+cost)\s*(?:of\s+)?[\$₹]?\s*(\d+(?:\.\d+)?[kK]?)', 'unit_economics', 'cac'),
    (r'(?:ltv|lifetime\s+value)\s*(?:of\s+)?[\$₹]?\s*(\d+(?:\.\d+)?[kK]?)', 'unit_economics', 'ltv'),
    (r'ltv[\s/:]cac\s*(?:of\s+)?(\d+(?:\.\d+)?)', 'unit_economics', 'ltv_cac_ratio'),
    (r'churn\s+(?:rate\s+)?(?:of\s+)?(\d+(?:\.\d+)?%)', 'unit_economics', 'churn'),
    (r'(?:nps|net\s+promoter)\s+(?:score\s+)?(?:of\s+)?(\d+)', 'unit_economics', 'nps'),

    # Time-based traction
    (r'(\d+)\s*years?\s+(?:building|running|operating)', 'experience', 'years_building'),
    (r'(?:launched|started)\s+(\d+)\s*(?:months?|years?)\s+ago', 'experience', 'time_since_launch'),
    (r'(?:profitable|breakeven)\s+(?:in|for)\s+(\d+)\s*months?', 'profitability', 'time_to_profit'),
]


def extract_traction_signals(text: str) -> List[Dict[str, str]]:
    """
    Extract traction signals from text.

    Returns list of:
        {
            "type": str,  # customers, revenue, funding, growth, etc.
            "subtype": str,  # specific metric type
            "value": str,  # extracted value
            "raw_match": str,  # original matched text
        }
    """
    signals = []
    text_lower = text.lower()

    for pattern, signal_type, subtype in TRACTION_PATTERNS:
        matches = re.finditer(pattern, text_lower, re.IGNORECASE)
        for match in matches:
            # Get the captured group (usually group 1)
            value = match.group(1) if match.lastindex >= 1 else match.group(0)
            signals.append({
                "type": signal_type,
                "subtype": subtype,
                "value": value,
                "raw_match": match.group(0),
            })

    # Deduplicate by raw_match
    seen = set()
    unique_signals = []
    for s in signals:
        if s["raw_match"] not in seen:
            seen.add(s["raw_match"])
            unique_signals.append(s)

    return unique_signals


# ============================================================================
# Credential Patterns
# ============================================================================

# Top universities (India + International)
TOP_UNIVERSITIES = [
    # IITs
    "iit", "iit bombay", "iit delhi", "iit madras", "iit kanpur", "iit kharagpur",
    "iit roorkee", "iit guwahati", "iit hyderabad",
    # IIMs
    "iim", "iim ahmedabad", "iim bangalore", "iim calcutta", "iim lucknow",
    # Other Indian
    "bits pilani", "bits", "nit", "iisc", "isb", "xlri", "srcc", "stephens",
    # US Universities
    "stanford", "harvard", "mit", "wharton", "yale", "princeton", "columbia",
    "berkeley", "caltech", "carnegie mellon", "cmu", "cornell", "nyu",
    # UK Universities
    "oxford", "cambridge", "lse", "imperial",
]

# Top tech companies
TOP_COMPANIES = [
    # FAANG/MAANG
    "google", "facebook", "meta", "amazon", "apple", "netflix", "microsoft",
    # Other US tech
    "uber", "airbnb", "stripe", "coinbase", "openai", "anthropic", "tesla",
    "salesforce", "oracle", "adobe", "linkedin", "twitter", "x.com",
    # Indian unicorns
    "flipkart", "swiggy", "zomato", "razorpay", "zerodha", "cred", "phonepe",
    "paytm", "ola", "byju", "unacademy", "meesho", "lenskart", "nykaa",
    "freshworks", "zoho", "infosys", "tcs", "wipro",
    # Consulting/Finance
    "mckinsey", "bain", "bcg", "goldman sachs", "morgan stanley", "jpmorgan",
    "kpmg", "deloitte", "ey", "pwc",
]

# Accelerators and VCs
ACCELERATORS_VCS = [
    "y combinator", "yc", "techstars", "500 startups", "500", "plug and play",
    "sequoia", "accel", "matrix", "blume", "kalaari", "elevation", "lightspeed",
    "tiger global", "a16z", "andreessen", "greylock", "benchmark",
    "peak xv", "nexus", "chiratae", "stellaris", "prime", "india quotient",
]

CREDENTIAL_PATTERNS = [
    # Education - top universities
    (r'(?:studied|graduated|degree|alumni|from)\s+(?:at\s+)?(' + '|'.join(TOP_UNIVERSITIES) + ')', 'education', 'university'),
    (r'(' + '|'.join(TOP_UNIVERSITIES) + r')\s*(?:graduate|alumni|alum)', 'education', 'university'),

    # Work experience - top companies
    (r'(?:worked|work|working)\s+(?:at|for)\s+(' + '|'.join(TOP_COMPANIES) + ')', 'work_experience', 'company'),
    (r'ex[\-\s]?(' + '|'.join(TOP_COMPANIES) + ')', 'work_experience', 'ex_company'),
    (r'(?:formerly|previously)\s+(?:at\s+)?(' + '|'.join(TOP_COMPANIES) + ')', 'work_experience', 'ex_company'),
    (r'(\d+)\s*years?\s+(?:at|with)\s+(' + '|'.join(TOP_COMPANIES) + ')', 'work_experience', 'tenure'),

    # Founder experience
    (r'(?:second|third|serial)\s*[\-\s]?time\s+founder', 'founder_experience', 'serial_founder'),
    (r'(?:previously|before)\s+(?:founded|started|built)\s+([A-Z][a-zA-Z]+)', 'founder_experience', 'previous_company'),
    (r'(?:exited|sold|acquired)\s+(?:my|our|the)?\s*(?:company|startup)', 'founder_experience', 'exit'),

    # Accelerator/VC backing
    (r'(?:backed|funded|invested)\s+by\s+(' + '|'.join(ACCELERATORS_VCS) + ')', 'backing', 'investor'),
    (r'(' + '|'.join(ACCELERATORS_VCS) + r')\s*(?:portfolio|backed|funded)', 'backing', 'investor'),
    (r'(?:part of|in|accepted to)\s+(' + '|'.join(ACCELERATORS_VCS) + ')', 'backing', 'accelerator'),

    # Role seniority
    (r'(?:ceo|cto|cfo|coo|founder|co-founder|cofounder)\s+(?:at|of)\s+([A-Z][a-zA-Z]+)', 'role', 'executive'),
    (r'(?:vp|vice president|director|head)\s+(?:of\s+)?(?:engineering|product|growth|marketing)', 'role', 'senior_role'),
]


def extract_credential_signals(text: str) -> List[Dict[str, str]]:
    """
    Extract credential signals from text.

    Returns list of:
        {
            "type": str,  # education, work_experience, founder_experience, etc.
            "subtype": str,  # specific credential type
            "value": str,  # extracted value (university, company name, etc.)
            "raw_match": str,  # original matched text
        }
    """
    signals = []
    text_lower = text.lower()

    for pattern, signal_type, subtype in CREDENTIAL_PATTERNS:
        try:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                # Get the captured group (usually group 1)
                # Handle case where lastindex is None (no capturing groups)
                if match.lastindex is not None and match.lastindex >= 1:
                    value = match.group(1)
                else:
                    value = match.group(0)
                signals.append({
                    "type": signal_type,
                    "subtype": subtype,
                    "value": value.strip() if value else "",
                    "raw_match": match.group(0),
                })
        except (re.error, AttributeError, IndexError):
            # Skip patterns with errors
            continue

    # Deduplicate by raw_match
    seen = set()
    unique_signals = []
    for s in signals:
        if s["raw_match"] not in seen:
            seen.add(s["raw_match"])
            unique_signals.append(s)

    return unique_signals


# ============================================================================
# Combined Signal Extraction
# ============================================================================

def extract_all_signals(text: str) -> Dict[str, Any]:
    """
    Extract all concrete signals from text.

    Returns:
        {
            "traction": List[Dict],
            "credentials": List[Dict],
            "total_count": int,
            "summary": str
        }
    """
    traction = extract_traction_signals(text)
    credentials = extract_credential_signals(text)

    total_count = len(traction) + len(credentials)

    # Generate summary
    summary_parts = []
    if traction:
        traction_types = set(s["type"] for s in traction)
        summary_parts.append(f"Traction signals: {', '.join(traction_types)}")
    if credentials:
        cred_types = set(s["type"] for s in credentials)
        summary_parts.append(f"Credential signals: {', '.join(cred_types)}")

    summary = "; ".join(summary_parts) if summary_parts else "No concrete signals detected"

    return {
        "traction": traction,
        "credentials": credentials,
        "total_count": total_count,
        "summary": summary
    }


def extract_signals_from_conversation(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Extract signals from entire conversation history.

    Returns aggregated signals across all user messages.
    """
    all_traction = []
    all_credentials = []

    for msg in messages:
        if msg.get("role") == "user":
            signals = extract_all_signals(msg.get("content", ""))
            all_traction.extend(signals["traction"])
            all_credentials.extend(signals["credentials"])

    # Deduplicate across messages
    seen_traction = set()
    unique_traction = []
    for s in all_traction:
        key = f"{s['type']}:{s['value']}"
        if key not in seen_traction:
            seen_traction.add(key)
            unique_traction.append(s)

    seen_creds = set()
    unique_creds = []
    for s in all_credentials:
        key = f"{s['type']}:{s['value']}"
        if key not in seen_creds:
            seen_creds.add(key)
            unique_creds.append(s)

    return {
        "traction": unique_traction,
        "credentials": unique_creds,
        "total_count": len(unique_traction) + len(unique_creds),
    }


def get_signal_strength(signal_count: int, turn_count: int) -> str:
    """
    Evaluate signal strength relative to conversation progress.

    Returns: "strong", "moderate", "weak", "none"
    """
    if signal_count == 0:
        return "none"

    # Expect more signals as conversation progresses
    if turn_count <= 2:
        if signal_count >= 2:
            return "strong"
        elif signal_count >= 1:
            return "moderate"
    else:  # turn 3+
        if signal_count >= 3:
            return "strong"
        elif signal_count >= 2:
            return "moderate"
        else:
            return "weak"

    return "weak"
