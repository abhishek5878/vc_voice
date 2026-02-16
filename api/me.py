"""
GET /api/me — current user and workspace (requires Authorization: Bearer <token>).
Returns { email, workspace_id, plan } or 401.
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.supabase_client import get_user_from_jwt, get_workspace_by_owner, is_configured


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }


def _get_bearer(request) -> str:
    if not hasattr(request, "headers"):
        return ""
    h = request.headers
    auth = h.get("Authorization") if hasattr(h, "get") else ""
    if isinstance(auth, str) and auth.startswith("Bearer "):
        return auth[7:].strip()
    return ""


def _handle(request):
    if getattr(request, "method", None) == "OPTIONS":
        return {"statusCode": 200, "headers": {**_cors_headers()}, "body": ""}

    if getattr(request, "method", None) != "GET":
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Method not allowed"}),
        }

    if not is_configured():
        return {
            "statusCode": 503,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Auth not configured"}),
        }

    token = _get_bearer(request)
    if not token:
        return {
            "statusCode": 401,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Authorization required"}),
        }

    user = get_user_from_jwt(token)
    if not user:
        return {
            "statusCode": 401,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Invalid or expired token"}),
        }

    uid = user.get("sub")
    workspace = get_workspace_by_owner(uid) if uid else None
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", **_cors_headers()},
        "body": json.dumps({
            "email": user.get("email"),
            "workspace_id": workspace["id"] if workspace else None,
            "plan": workspace.get("plan", "free") if workspace else "free",
        }),
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        result = _handle(type("Req", (), {"method": "OPTIONS", "headers": self.headers})())
        self._send(result)

    def do_GET(self):
        req = type("Req", (), {"method": "GET", "headers": self.headers})()
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
