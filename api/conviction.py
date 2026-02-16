"""
Robin.ai Phase 3 - Conviction Score API
GET /api/conviction?conversation_id=xxx

Returns conviction score (0-1) for a conversation from triage evaluation.
Used by downstream tools / dashboard.
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.contacts_store import get_contact_by_conversation_id


def _handle(request):
    if getattr(request, "method", None) != "GET":
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Method not allowed"}),
        }

    # Query string: conversation_id
    query = getattr(request, "path", "") or ""
    if "?" in query:
        qs = query.split("?", 1)[1]
        params = {}
        for part in qs.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                params[k.strip()] = v.strip()
    else:
        params = {}
    conversation_id = params.get("conversation_id", "").strip()
    if not conversation_id:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "conversation_id required"}),
        }

    contact = get_contact_by_conversation_id(conversation_id)
    if not contact:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Lead not found"}),
        }

    ev = contact.get("evaluation_result") or {}
    score_0_10 = ev.get("score", 0)
    if not isinstance(score_0_10, (int, float)):
        score_0_10 = 0
    conviction_score = round(min(1.0, max(0.0, float(score_0_10) / 10.0)), 2)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps({
            "conversation_id": conversation_id,
            "conviction_score": conviction_score,
            "source": "evaluation",
            "recommendation": ev.get("recommendation"),
            "score_0_10": score_0_10,
        }),
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        req = type("Req", (), {"method": "GET", "path": self.path})()
        result = _handle(req)
        self.send_response(result["statusCode"])
        for k, v in result.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
        body = result.get("body", "")
        if body:
            self.wfile.write(body.encode("utf-8") if isinstance(body, str) else body)
