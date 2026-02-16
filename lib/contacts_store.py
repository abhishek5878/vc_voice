"""
PI Triage - Contact persistence and updates.
Load/save/update contacts.json; used for evaluation persistence and override.
Supports workspace_id for partitioning (identity / stickiness).
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from .config import get_data_path, TRIAGE_RATE_LIMIT_DAYS


def _load_contacts() -> List[Dict[str, Any]]:
    path = get_data_path("contacts.json")
    try:
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return []


def _save_contacts(contacts: List[Dict[str, Any]]) -> None:
    path = get_data_path("contacts.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(contacts, f, indent=2)


def _normalize_workspace(workspace_id: Optional[str]) -> str:
    if workspace_id and str(workspace_id).strip():
        return str(workspace_id).strip().lower()[:64]
    return "default"


def get_contact_by_conversation_id(conversation_id: str) -> Optional[Dict[str, Any]]:
    """Return the contact record for this conversation_id, or None."""
    for c in _load_contacts():
        if c.get("conversation_id") == conversation_id:
            return c
    return None


def update_contact(conversation_id: str, updates: Dict[str, Any]) -> bool:
    """Update a contact by conversation_id. Returns True if found and updated."""
    contacts = _load_contacts()
    for i, c in enumerate(contacts):
        if c.get("conversation_id") == conversation_id:
            contacts[i] = {**c, **updates}
            _save_contacts(contacts)
            return True
    return False


def append_contact(contact_data: Dict[str, Any]) -> None:
    """Append a new contact (used at intake). Ensures workspace_id is set."""
    contact_data = dict(contact_data)
    contact_data.setdefault("workspace_id", _normalize_workspace(contact_data.get("workspace_id")))
    contacts = _load_contacts()
    contacts.append(contact_data)
    _save_contacts(contacts)


def get_all_leads(
    include_pending: bool = True,
    workspace_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return contacts (leads). Filter by workspace_id if provided."""
    contacts = _load_contacts()
    wid = _normalize_workspace(workspace_id)
    contacts = [c for c in contacts if _normalize_workspace(c.get("workspace_id")) == wid]
    if not include_pending:
        contacts = [c for c in contacts if c.get("evaluation_result")]
    return contacts


def email_already_triaged_recently(
    email: str,
    workspace_id: Optional[str],
    within_days: int = TRIAGE_RATE_LIMIT_DAYS,
) -> bool:
    """True if this email has completed triage (evaluation) in this workspace within the last N days."""
    if not email or "@" not in email:
        return False
    email_lower = email.strip().lower()
    wid = _normalize_workspace(workspace_id)
    cutoff = (datetime.utcnow() - timedelta(days=within_days)).isoformat()
    for c in _load_contacts():
        if _normalize_workspace(c.get("workspace_id")) != wid:
            continue
        if (c.get("email") or "").strip().lower() != email_lower:
            continue
        if not c.get("evaluation_result"):
            continue
        evaluated_at = c.get("evaluated_at") or c.get("timestamp") or ""
        if evaluated_at and evaluated_at >= cutoff:
            return True
    return False


def get_override_summary(workspace_id: Optional[str], within_days: int = 30) -> Dict[str, Any]:
    """Count overrides in the last N days for this workspace. For dashboard."""
    wid = _normalize_workspace(workspace_id)
    cutoff = (datetime.utcnow() - timedelta(days=within_days)).isoformat()
    contacts = get_all_leads(include_pending=True, workspace_id=workspace_id)
    approved = rejected = 0
    for c in contacts:
        if c.get("override") not in ("approved", "rejected"):
            continue
        at = c.get("override_at") or c.get("timestamp") or ""
        if at and at >= cutoff:
            if c.get("override") == "approved":
                approved += 1
            else:
                rejected += 1
    return {"overrides_last_30_days": approved + rejected, "approved": approved, "rejected": rejected}
