"""
Robin.ai / Skeptical Principal — Analyze endpoint.
POST /api/analyze

Accepts meeting transcript (e.g. Granola) and/or dictation (e.g. Wispr).
Returns Evidence Map, GRUE Diligence Checklist, Conflict Report, GRUE Verdict.
BYOK: X-API-Key header (OpenAI). If GROQ_API_KEY is set, Groq is used (zero-cost).
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

# Project root for app.services
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Optional: use tenant API key from header; distill() also uses GROQ_API_KEY env
def _get_api_key_from_request(request):
    if hasattr(request, "headers"):
        h = request.headers
        if hasattr(h, "get"):
            return (h.get("X-API-Key") or h.get("x-api-key") or "").strip()
    return ""


def _handle_analyze_history(request):
    """GET /api/analyze/history — list analyses for workspace."""
    path = getattr(request, "path", "") or ""
    params = {}
    if "?" in path:
        for part in path.split("?", 1)[1].split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                params[k.strip()] = v.strip()
    workspace_id = params.get("workspace_id", "").strip() or None
    limit = min(50, max(1, int(params.get("limit", 20))))
    from lib.analyze_store import get_analyses
    analyses = get_analyses(workspace_id, limit=limit)
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key, X-Workspace-Id",
        },
        "body": json.dumps({"analyses": analyses}),
    }


def _get_bearer_workspace(request, data):
    """If Authorization: Bearer present, resolve workspace_id from auth; else use body/header."""
    if not hasattr(request, "headers"):
        return None
    h = request.headers
    auth = h.get("Authorization") if hasattr(h, "get") else ""
    if isinstance(auth, str) and auth.startswith("Bearer "):
        token = auth[7:].strip()
        if token:
            try:
                from lib.supabase_client import get_user_from_jwt, get_workspace_by_owner
                user = get_user_from_jwt(token)
                if user and user.get("sub"):
                    w = get_workspace_by_owner(user["sub"])
                    if w:
                        return w.get("id")
            except Exception:
                pass
    return data.get("workspace_id") or (h.get("X-Workspace-Id") if hasattr(h, "get") else None) or ""


def _handle(request):
    path = getattr(request, "path", "") or ""
    if hasattr(request, "method") and request.method == "GET" and "/history" in path:
        return _handle_analyze_history(request)
    if hasattr(request, "method") and request.method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization, X-Workspace-Id",
            },
            "body": "",
        }

    if getattr(request, "method", None) != "POST":
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Method not allowed"}),
        }

    try:
        body = getattr(request, "body", None)
        if isinstance(body, bytes):
            body = body.decode("utf-8")
        if not body:
            body = "{}"
        data = json.loads(body)
    except (TypeError, ValueError) as e:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Invalid JSON", "detail": str(e)}),
        }

    text = (data.get("text") or "").strip()
    transcript_text = (data.get("transcript_text") or "").strip()
    dictation_text = (data.get("dictation_text") or "").strip()
    tool_hint = (data.get("tool_hint") or "").strip() or None

    # Require at least one source
    if transcript_text and dictation_text:
        # Dual-source: conflict report; leave text empty
        text = None
    elif transcript_text and not dictation_text:
        text = transcript_text
        transcript_text = ""
        dictation_text = ""
        if not tool_hint:
            tool_hint = "granola"
    elif dictation_text and not transcript_text:
        text = dictation_text
        transcript_text = ""
        dictation_text = ""
        if not tool_hint:
            tool_hint = "wispr"
    elif text:
        transcript_text = ""
        dictation_text = ""
    else:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Provide text, or transcript_text, or both transcript_text and dictation_text",
            }),
        }

    workspace_id = _get_bearer_workspace(request, data)
    workspace_id = (workspace_id or "").strip() or None

    # Plan limit: Free tier = 5 analyses/month
    try:
        from lib.plan_limits import check_analysis_limit
        allowed, limit_msg = check_analysis_limit(workspace_id)
        if not allowed:
            return {
                "statusCode": 402,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": limit_msg}),
            }
    except Exception:
        pass

    api_key = _get_api_key_from_request(request)
    if not api_key and not os.environ.get("GROQ_API_KEY"):
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Provide X-API-Key (OpenAI) or set GROQ_API_KEY for zero-cost analysis",
            }),
        }

    try:
        from backend.services.universal_intake import distill
    except ImportError:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Analyze service unavailable (universal_intake not found)",
            }),
        }

    try:
        result = distill(
            text=text or None,
            api_key=api_key or None,
            persona_name="the VC",
            tool_hint=tool_hint,
            transcript_text=transcript_text or None,
            dictation_text=dictation_text or None,
        )
    except Exception as e:
        import traceback
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Analysis failed",
                "detail": str(e),
                "trace": traceback.format_exc() if os.environ.get("DEBUG") else None,
            }),
        }

    # SPA (Skeptical Principal Architecture) 4-layer formatted output
    mode = int(data.get("mode") or 1)
    if mode not in (1, 2, 3):
        mode = 1
    include_conviction = bool(data.get("include_conviction"))
    try:
        from lib.spa_pipeline import run_spa_formatter
        spa = run_spa_formatter(
            result,
            mode=mode,
            transcript_text=transcript_text or None,
            dictation_text=dictation_text or None,
            include_conviction=include_conviction,
        )
    except Exception:
        spa = {}

    # Shape response for frontend (Phase 2/3: ai_polish, conviction_score) + SPA layers
    appraisal = result.get("immediate_appraisal") or {}
    response = {
        "source_type": result.get("source_type", "note"),
        "tool": result.get("tool", "unknown"),
        "mode": mode,
        "evidence_log": result.get("evidence_log", []),
        "unverified_signals": result.get("unverified_signals", []),
        "blind_spots": result.get("blind_spots", []),
        "questions_for_next_meeting": result.get("questions_for_next_meeting", []),
        "conflict_report": result.get("conflict_report", []),
        "immediate_appraisal": {
            "hook": appraisal.get("hook"),
            "signal_count": appraisal.get("signal_count"),
            "verified_count": appraisal.get("verified_count"),
            "grue_verdict": appraisal.get("grue_verdict"),
            "conviction_score": appraisal.get("conviction_score"),
            "immediate_appraisal_markdown": appraisal.get("immediate_appraisal_markdown"),
            "pedigree": appraisal.get("pedigree"),
        },
        "ai_polish": result.get("ai_polish"),
        "pedigree": result.get("pedigree"),
        "layer_1_sel": spa.get("layer_1_sel", []),
        "layer_2_conflict_report": spa.get("layer_2_conflict_report", []),
        "layer_3_grue_stress_test": spa.get("layer_3_grue_stress_test", []),
        "layer_4_red_list": spa.get("layer_4_red_list", []),
        "layer_4_yellow_list": spa.get("layer_4_yellow_list", []),
        "layer_4_pedigree_check": spa.get("layer_4_pedigree_check", []),
    }
    if spa.get("pre_meeting_attack_brief"):
        response["pre_meeting_attack_brief"] = spa["pre_meeting_attack_brief"]
    if spa.get("conviction"):
        response["conviction"] = spa["conviction"]

    # Persist to analyze history (stickiness) when workspace_id present
    try:
        from lib.analyze_store import append_analysis
        transcript_preview = (text or transcript_text or dictation_text or "")[:300]
        append_analysis(workspace_id, result, transcript_preview)
    except Exception:
        pass

    # Record usage for plan limits (Free: 5/month)
    try:
        from lib.plan_limits import record_analysis
        if workspace_id:
            record_analysis(workspace_id)
    except Exception:
        pass

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization, X-Workspace-Id",
        },
        "body": json.dumps(response),
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        result = _handle(type("Req", (), {"method": "OPTIONS", "path": self.path, "headers": self.headers})())
        self._send(result)

    def do_GET(self):
        req = type("Req", (), {"method": "GET", "path": self.path, "headers": self.headers})()
        result = _handle(req)
        self._send(result)

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body_raw = self.rfile.read(content_length) if content_length else b""
        body_str = body_raw.decode("utf-8") if body_raw else "{}"
        req = type("Req", (), {"method": "POST", "body": body_str, "path": self.path, "headers": self.headers})()
        result = _handle(req)
        self._send(result)

    def _send(self, result):
        self.send_response(result["statusCode"])
        for k, v in result.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
        body = result.get("body", "")
        if body:
            self.wfile.write(body.encode("utf-8") if isinstance(body, str) else body)
