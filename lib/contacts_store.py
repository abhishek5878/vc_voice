"""
PI Triage - Contact persistence and updates.
Load/save/update contacts.json; used for evaluation persistence and override.
"""

import json
import os
from typing import Dict, List, Any, Optional
from .config import get_data_path


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
    """Append a new contact (used at intake)."""
    contacts = _load_contacts()
    contacts.append(contact_data)
    _save_contacts(contacts)


def get_all_leads(include_pending: bool = True) -> List[Dict[str, Any]]:
    """Return all contacts (leads) for export/tuning. Optionally exclude those without evaluation."""
    contacts = _load_contacts()
    if not include_pending:
        contacts = [c for c in contacts if c.get("evaluation_result")]
    return contacts
