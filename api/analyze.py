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


def _handle(request):
    if hasattr(request, "method") and request.method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
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

    workspace_id = data.get("workspace_id") or (request.headers.get("X-Workspace-Id") if hasattr(request, "headers") else None) or ""
    workspace_id = (workspace_id or "").strip() or None

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
        from app.services.universal_intake import distill
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

    # Shape response for frontend (Phase 2/3: ai_polish, conviction_score)
    appraisal = result.get("immediate_appraisal") or {}
    response = {
        "source_type": result.get("source_type", "note"),
        "tool": result.get("tool", "unknown"),
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
    }

    # Persist to analyze history (stickiness) when workspace_id present
    try:
        from lib.analyze_store import append_analysis
        transcript_preview = (text or transcript_text or dictation_text or "")[:300]
        append_analysis(workspace_id, result, transcript_preview)
    except Exception:
        pass

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
        },
        "body": json.dumps(response),
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        result = _handle(type("Req", (), {"method": "OPTIONS", "headers": self.headers})())
        self._send(result)

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body_raw = self.rfile.read(content_length) if content_length else b""
        body_str = body_raw.decode("utf-8") if body_raw else "{}"
        req = type("Req", (), {"method": "POST", "body": body_str, "headers": self.headers})()
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
