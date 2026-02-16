"""
Memory layer: learn from overrides and usage per workspace.
Stores override history and derives a short "Your style" profile.
"""

import json
import os
from collections import Counter
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from .config import get_data_path


MEMORY_FILE = "memory.json"
MAX_HISTORY = 100
PROFILE_LOOKBACK_DAYS = 90


def _path() -> str:
    return get_data_path(MEMORY_FILE)


def _load() -> Dict[str, Any]:
    try:
        if os.path.isfile(_path()):
            with open(_path(), "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {"workspaces": {}}


def _save(data: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(_path()), exist_ok=True)
    with open(_path(), "w") as f:
        json.dump(data, f, indent=2)


def _normalize_workspace(workspace_id: Optional[str]) -> str:
    if workspace_id and str(workspace_id).strip():
        return str(workspace_id).strip().lower()[:64]
    return "default"


def append_override_memory(
    workspace_id: Optional[str],
    outcome: str,
    reason: str = "",
    contact: Optional[Dict[str, Any]] = None,
) -> None:
    """Record one override so we can learn style. contact = full lead for segment, raising_status, score."""
    wid = _normalize_workspace(workspace_id)
    data = _load()
    if "workspaces" not in data:
        data["workspaces"] = {}
    if wid not in data["workspaces"]:
        data["workspaces"][wid] = {"override_history": [], "updated_at": None}
    ev = contact.get("evaluation_result") if contact else {}
    entry = {
        "at": datetime.utcnow().isoformat(),
        "outcome": outcome,
        "reason": (reason or "").strip()[:500],
        "score": ev.get("score"),
        "recommendation": ev.get("recommendation"),
        "segment": contact.get("segment") or "",
        "raising_status": contact.get("raising_status") or "",
    }
    data["workspaces"][wid]["override_history"].append(entry)
    data["workspaces"][wid]["override_history"] = data["workspaces"][wid]["override_history"][-MAX_HISTORY:]
    data["workspaces"][wid]["updated_at"] = datetime.utcnow().isoformat()
    _save(data)


def get_learned_profile(workspace_id: Optional[str]) -> Dict[str, Any]:
    """
    Derive a short "Your style" from override history (rule-based).
    Returns { summary_sentences: [...], override_count, approved_count, rejected_count }.
    """
    wid = _normalize_workspace(workspace_id)
    data = _load()
    history = (data.get("workspaces") or {}).get(wid) or {}
    events = history.get("override_history") or []
    cutoff = (datetime.utcnow() - timedelta(days=PROFILE_LOOKBACK_DAYS)).isoformat()
    events = [e for e in events if (e.get("at") or "") >= cutoff]
    if not events:
        return {
            "summary_sentences": [],
            "override_count": 0,
            "approved_count": 0,
            "rejected_count": 0,
        }
    approved = [e for e in events if e.get("outcome") == "approved"]
    rejected = [e for e in events if e.get("outcome") == "rejected"]
    sentences = []
    # What you often approve
    if approved:
        segs = Counter(e.get("segment") or "other" for e in approved)
        raising = Counter(e.get("raising_status") or "unspecified" for e in approved)
        scores = [e.get("score") for e in approved if e.get("score") is not None]
        top_seg = segs.most_common(1)[0][0] if segs else None
        top_raising = raising.most_common(1)[0][0] if raising else None
        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        parts = []
        if top_seg and top_seg != "other":
            parts.append(f"segment {top_seg}")
        if top_raising and top_raising != "unspecified":
            parts.append(f"raising status {top_raising}")
        if avg_score is not None:
            parts.append(f"score around {avg_score}")
        if parts:
            sentences.append("You often approve when " + " and ".join(parts) + ".")
        else:
            sentences.append(f"You've approved {len(approved)} lead(s) in the last {PROFILE_LOOKBACK_DAYS} days.")
    # What you tend to reject
    if rejected:
        segs = Counter(e.get("segment") or "other" for e in rejected)
        top_seg = segs.most_common(1)[0][0] if segs else None
        if top_seg and top_seg != "other":
            sentences.append(f"You tend to reject {top_seg} intros.")
        else:
            sentences.append(f"You've rejected {len(rejected)} lead(s) in this period.")
    return {
        "summary_sentences": sentences[:5],
        "override_count": len(events),
        "approved_count": len(approved),
        "rejected_count": len(rejected),
    }


def get_memory(workspace_id: Optional[str]) -> Dict[str, Any]:
    """Full memory view for API: learned profile + optional recent history count."""
    profile = get_learned_profile(workspace_id)
    return {
        "learned_profile": profile,
        "override_history_count": profile.get("override_count", 0),
    }
