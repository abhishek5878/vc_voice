"""
Robin.ai - Analyze history persistence (stickiness: "my last analyses").
Stored by workspace_id for pipeline / usage visibility.
"""

import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from .config import get_data_path


def _path() -> str:
    return get_data_path("analyses.json")


def _load() -> List[Dict[str, Any]]:
    try:
        if os.path.isfile(_path()):
            with open(_path(), "r") as f:
                return json.load(f)
    except Exception:
        pass
    return []


def _save(analyses: List[Dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(_path()), exist_ok=True)
    with open(_path(), "w") as f:
        json.dump(analyses, f, indent=2)


def _normalize_workspace(workspace_id: Optional[str]) -> str:
    if workspace_id and str(workspace_id).strip():
        return str(workspace_id).strip().lower()[:64]
    return "default"


def append_analysis(
    workspace_id: Optional[str],
    result: Dict[str, Any],
    transcript_preview: str = "",
) -> str:
    """Append a summary of an analyze result. Returns analysis id."""
    wid = _normalize_workspace(workspace_id)
    appraisal = result.get("immediate_appraisal") or {}
    entry = {
        "id": str(uuid.uuid4()),
        "workspace_id": wid,
        "timestamp": datetime.utcnow().isoformat(),
        "transcript_preview": (transcript_preview or "")[:300],
        "grue_verdict": appraisal.get("grue_verdict"),
        "conviction_score": appraisal.get("conviction_score"),
        "hook": (appraisal.get("hook") or "")[:200],
    }
    analyses = _load()
    analyses.append(entry)
    _save(analyses)
    return entry["id"]


def get_analyses(workspace_id: Optional[str], limit: int = 20) -> List[Dict[str, Any]]:
    """Return last N analyses for this workspace, newest first."""
    wid = _normalize_workspace(workspace_id)
    analyses = [a for a in _load() if a.get("workspace_id") == wid]
    analyses.sort(key=lambda a: a.get("timestamp") or "", reverse=True)
    return analyses[:limit]
