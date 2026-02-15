"""
PI Triage System - Contact Classification
Classifies contacts based on email domain and current work description.
"""

import re
from typing import Dict, Tuple, List, Optional
from .config import CLASSIFICATION


def extract_email_domain(email: str) -> str:
    """Extract domain from email address."""
    if "@" not in email:
        return ""
    return email.split("@")[1].lower()


def classify_email_domain(email: str) -> Tuple[str, str, str]:
    """
    Classify contact based on email domain.

    Returns:
        (classification, country_hint, confidence)

    Classifications:
        - indian_student: .ac.in domain
        - us_student: .edu domain
        - tech_operator: Known tech company domain
        - generic: Unknown/generic domain
    """
    domain = extract_email_domain(email)
    if not domain:
        return "unknown", "unknown", "low"

    # Check for Indian student domains
    for suffix in CLASSIFICATION["indian_student_domains"]:
        if domain.endswith(suffix):
            return "indian_student", "India", "high"

    # Check for US/international student domains
    for suffix in CLASSIFICATION["us_student_domains"]:
        if domain.endswith(suffix):
            return "us_student", "US/International", "high"

    # Check for known tech company domains
    for tech_domain in CLASSIFICATION["tech_company_domains"]:
        if domain == tech_domain or domain.endswith("." + tech_domain):
            return "tech_operator", "unknown", "high"

    # Generic domain - could be anything
    return "generic", "unknown", "low"


def classify_role_from_text(text: str) -> Tuple[str, str, List[str]]:
    """
    Classify role based on current work description.

    Returns:
        (role, confidence, matched_keywords)

    Roles:
        - founder: Building/running a startup
        - student: Currently studying
        - operator: Working at a company
        - partnership: Sales/BD outreach
        - unknown: Can't determine
    """
    text_lower = text.lower()
    matches = {
        "founder": [],
        "student": [],
        "operator": [],
        "partnership": [],
    }

    # Check each category
    for keyword in CLASSIFICATION["founder_keywords"]:
        if keyword in text_lower:
            matches["founder"].append(keyword)

    for keyword in CLASSIFICATION["student_keywords"]:
        if keyword in text_lower:
            matches["student"].append(keyword)

    for keyword in CLASSIFICATION["operator_keywords"]:
        if keyword in text_lower:
            matches["operator"].append(keyword)

    for keyword in CLASSIFICATION["partnership_keywords"]:
        if keyword in text_lower:
            matches["partnership"].append(keyword)

    # Determine primary role based on strongest match
    # Priority: partnership > founder > operator > student
    # (Partnership is flagged as low-signal)
    if matches["partnership"]:
        return "partnership", "high" if len(matches["partnership"]) >= 2 else "medium", matches["partnership"]

    if matches["founder"]:
        return "founder", "high" if len(matches["founder"]) >= 2 else "medium", matches["founder"]

    if matches["operator"]:
        return "operator", "high" if len(matches["operator"]) >= 2 else "medium", matches["operator"]

    if matches["student"]:
        return "student", "high" if len(matches["student"]) >= 2 else "medium", matches["student"]

    return "unknown", "low", []


def classify_contact(
    email: str,
    current_work: str
) -> Dict[str, any]:
    """
    Full contact classification combining email and text analysis.

    Returns:
        {
            "email_classification": str,
            "country_hint": str,
            "email_confidence": str,
            "role": str,
            "role_confidence": str,
            "role_keywords": List[str],
            "combined_classification": str,
            "warning": Optional[str],
            "is_low_signal": bool
        }
    """
    # Email classification
    email_class, country_hint, email_conf = classify_email_domain(email)

    # Role classification
    role, role_conf, role_keywords = classify_role_from_text(current_work)

    # Combined classification logic
    combined = "unknown"
    warning = None
    is_low_signal = False

    # Partnership/sales = low signal flag
    if role == "partnership":
        combined = "partnership"
        warning = "Partnership/sales outreach is typically low-signal for Sajith."
        is_low_signal = True

    # Student classification
    elif email_class in ["indian_student", "us_student"] or role == "student":
        combined = "student"
        if email_class == "indian_student":
            combined = "indian_student"
        elif email_class == "us_student":
            combined = "us_student"

    # Founder classification
    elif role == "founder":
        combined = "founder"

    # Operator classification
    elif role == "operator" or email_class == "tech_operator":
        combined = "operator"

    # Generic/unknown
    else:
        combined = "unknown"
        warning = "Unable to classify contact. Will require more signals during conversation."

    return {
        "email_classification": email_class,
        "country_hint": country_hint,
        "email_confidence": email_conf,
        "role": role,
        "role_confidence": role_conf,
        "role_keywords": role_keywords,
        "combined_classification": combined,
        "warning": warning,
        "is_low_signal": is_low_signal,
    }


def get_classification_context(classification: Dict[str, any]) -> str:
    """
    Generate context string for PI based on classification.
    This helps PI tailor its questions.
    """
    combined = classification["combined_classification"]
    country = classification["country_hint"]

    contexts = {
        "founder": "This person identifies as a founder. Probe for traction, funding, and specific metrics.",
        "indian_student": f"This is likely a student from India ({country}). Students often seek career advice - determine if there's a specific, actionable reason to talk to Sajith.",
        "us_student": "This is likely a US/international student. Same considerations as Indian student.",
        "student": "This person appears to be a student. Focus on whether they have a specific, actionable need.",
        "operator": "This person works at a company. Determine if they're exploring founding, need specific advice, or are just networking.",
        "partnership": "WARNING: This appears to be a sales/partnership pitch. These are typically low-signal. Be extra skeptical.",
        "unknown": "Classification unclear. Use the first few turns to understand who this person is and why they want to talk to Sajith.",
    }

    return contexts.get(combined, contexts["unknown"])


def extract_company_from_text(text: str) -> Optional[str]:
    """
    Try to extract company name from text.
    Used for additional context.
    """
    # Common patterns: "at X", "for X", "at Company"
    patterns = [
        r'(?:at|for|with)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)',
        r'(?:working\s+at|joined)\s+([A-Z][a-zA-Z0-9]+)',
        r'(?:founded|co-founded|started)\s+([A-Z][a-zA-Z0-9]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)

    return None
