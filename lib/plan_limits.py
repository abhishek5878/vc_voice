"""
Robin.ai plan limits: Free vs Solo (and above).
Free: 5 analyses per month; Solo+: unlimited.
"""

from typing import Optional, Tuple

# Free tier limit
FREE_ANALYSES_PER_MONTH = 5


def get_plan_for_workspace(workspace_id: Optional[str]) -> str:
    """Return plan for workspace: free | solo | partner | fund | enterprise. Default free if unknown."""
    if not workspace_id:
        return "free"
    from .supabase_client import is_configured, get_workspace_by_id
    if not is_configured():
        return "free"
    w = get_workspace_by_id(workspace_id)
    if not w:
        return "free"
    return (w.get("plan") or "free").lower()


def check_analysis_limit(workspace_id: Optional[str]) -> Tuple[bool, str]:
    """
    Returns (allowed, message).
    If allowed is False, message explains limit (e.g. "Free plan: 5 analyses per month. Upgrade to Solo for unlimited.").
    """
    plan = get_plan_for_workspace(workspace_id)
    if plan in ("solo", "partner", "fund", "enterprise"):
        return True, ""

    from .supabase_client import is_configured, count_analyses_this_month
    if not is_configured():
        return True, ""  # No DB: allow (backward compat)

    used = count_analyses_this_month(workspace_id or "")
    if used >= FREE_ANALYSES_PER_MONTH:
        return False, (
            f"Free plan limit: {FREE_ANALYSES_PER_MONTH} analyses per month. "
            "Upgrade to Solo for unlimited analyses."
        )
    return True, ""


def record_analysis(workspace_id: Optional[str]) -> bool:
    """Record one analysis usage for the workspace. Returns True if recorded."""
    if not workspace_id:
        return False
    from .supabase_client import is_configured, record_analysis_usage
    if not is_configured():
        return False
    return record_analysis_usage(workspace_id)
