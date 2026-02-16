"""
Supabase client for Robin.ai auth and workspace/plan data.
Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-side only).
If not set, auth and plan features are disabled.
"""

import os
from typing import Optional, Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
SUPABASE_ANON_KEY = (os.environ.get("SUPABASE_ANON_KEY") or "").strip()


def _headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def is_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def auth_signup(email: str, password: str) -> dict:
    """Call Supabase Auth signup. Returns { user, session } or { error }."""
    if not is_configured():
        return {"error": "Auth not configured"}
    import httpx
    r = httpx.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        json={"email": email, "password": password},
        headers={"apikey": SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json"},
        timeout=15,
    )
    data = r.json()
    if r.status_code >= 400:
        return {"error": data.get("msg") or data.get("error_description") or "Signup failed"}
    return data


def auth_signin(email: str, password: str) -> dict:
    """Call Supabase Auth sign in. Returns { access_token, user } or { error }."""
    if not is_configured():
        return {"error": "Auth not configured"}
    import httpx
    r = httpx.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json"},
        timeout=15,
    )
    data = r.json()
    if r.status_code >= 400:
        return {"error": data.get("error_description") or data.get("msg") or "Login failed"}
    return data


def create_workspace_for_user(owner_id: str, name: str = "My Workspace") -> Optional[dict]:
    """Insert a workspace owned by owner_id (Supabase auth user id). Returns workspace row or None."""
    if not is_configured():
        return None
    import httpx
    import uuid
    wid = str(uuid.uuid4())
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/workspaces",
        json={"id": wid, "name": name, "owner_id": owner_id, "plan": "free"},
        headers=_headers(),
        timeout=10,
    )
    if r.status_code not in (200, 201):
        return None
    rows = r.json()
    return rows[0] if isinstance(rows, list) and rows else {"id": wid, "name": name, "owner_id": owner_id, "plan": "free"}


def get_workspace_by_owner(owner_id: str) -> Optional[dict]:
    """Get first workspace owned by owner_id."""
    if not is_configured():
        return None
    import httpx
    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/workspaces",
        params={"owner_id": f"eq.{owner_id}", "limit": "1"},
        headers=_headers(),
        timeout=10,
    )
    if r.status_code != 200:
        return None
    rows = r.json()
    return rows[0] if isinstance(rows, list) and rows else None


def get_workspace_by_id(workspace_id: str) -> Optional[dict]:
    if not is_configured():
        return None
    import httpx
    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/workspaces",
        params={"id": f"eq.{workspace_id}", "limit": "1"},
        headers=_headers(),
        timeout=10,
    )
    if r.status_code != 200:
        return None
    rows = r.json()
    return rows[0] if isinstance(rows, list) and rows else None


def update_workspace_plan(workspace_id: str, plan: str, stripe_customer_id: Optional[str] = None, stripe_subscription_id: Optional[str] = None) -> bool:
    """Update plan and optional Stripe ids for a workspace."""
    if not is_configured():
        return False
    import httpx
    payload = {"plan": plan}
    if stripe_customer_id is not None:
        payload["stripe_customer_id"] = stripe_customer_id
    if stripe_subscription_id is not None:
        payload["stripe_subscription_id"] = stripe_subscription_id
    r = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/workspaces?id=eq.{workspace_id}",
        json=payload,
        headers=_headers(),
        timeout=10,
    )
    return r.status_code in (200, 204)


def record_analysis_usage(workspace_id: str) -> bool:
    """Insert one row into analysis_usage for limit counting."""
    if not is_configured():
        return False
    import httpx
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/analysis_usage",
        json={"workspace_id": workspace_id},
        headers=_headers(),
        timeout=10,
    )
    return r.status_code in (200, 201)


def count_analyses_this_month(workspace_id: str) -> int:
    """Count analysis_usage rows for this workspace in the current month (UTC)."""
    if not is_configured():
        return 0
    import httpx
    from datetime import datetime
    # First day of current month UTC
    now = datetime.utcnow()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat() + "Z"
    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/analysis_usage",
        params={
            "workspace_id": f"eq.{workspace_id}",
            "used_at": f"gte.{start}",
            "select": "id",
        },
        headers={**_headers(), "Prefer": "count=exact"},
        timeout=10,
    )
    if r.status_code != 200:
        return 0
    # Content-Range header: 0-9/42 means total 42
    content_range = r.headers.get("Content-Range") or ""
    if "/" in content_range:
        try:
            return int(content_range.split("/")[1])
        except ValueError:
            pass
    return len(r.json()) if isinstance(r.json(), list) else 0


def get_user_from_jwt(token: str) -> Optional[dict]:
    """Verify JWT by calling Supabase Auth /user; return user payload (sub, email) or None."""
    if not token or not SUPABASE_URL:
        return None
    import httpx
    apikey = SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
    if not apikey:
        return None
    r = httpx.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": apikey, "Authorization": f"Bearer {token}"},
        timeout=5,
    )
    if r.status_code != 200:
        return None
    u = r.json()
    return {"sub": u.get("id"), "email": u.get("email")} if u.get("id") else None
