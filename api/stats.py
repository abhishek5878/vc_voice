"""
Robin.ai - Usage stats (stickiness: "you ran X analyses / Y triages").
GET /api/stats?workspace_id=xxx
No content, counts only.
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.contacts_store import get_all_leads, get_override_summary
from lib.analyze_store import get_analyses


def _handle(request):
    if getattr(request, "method", None) == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Workspace-Id",
            },
            "body": "",
        }
    if getattr(request, "method", None) != "GET":
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Method not allowed"}),
        }
    path = getattr(request, "path", "") or ""
    params = {}
    if "?" in path:
        for part in path.split("?", 1)[1].split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                params[k.strip()] = v.strip()
    workspace_id = params.get("workspace_id", "").strip() or None
    leads = get_all_leads(include_pending=True, workspace_id=workspace_id)
    triage_count = len([c for c in leads if c.get("evaluation_result")])
    analyses = get_analyses(workspace_id, limit=1000)
    override_summary = get_override_summary(workspace_id, within_days=30)
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({
            "triage_count": len(leads),
            "triage_completed_count": triage_count,
            "analyses_count": len(analyses),
            "override_summary": override_summary,
        }),
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        result = _handle(type("Req", (), {"method": "OPTIONS"})())
        self.send_response(result["statusCode"])
        for k, v in result.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
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
