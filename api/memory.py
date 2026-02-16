"""
GET /api/memory — memory layer: learned profile (your style) per workspace.
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.memory_store import get_memory


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
    out = get_memory(workspace_id)
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(out),
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        result = _handle(type("Req", (), {"method": "OPTIONS"})())
        self.send_response(result["statusCode"])
        for k, v in result.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        result = _handle(type("Req", (), {"method": "GET", "path": self.path})())
        self.send_response(result["statusCode"])
        for k, v in result.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
        body = result.get("body", "")
        if body:
            self.wfile.write(body.encode("utf-8") if isinstance(body, str) else body)
