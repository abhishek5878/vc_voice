"""
Robin.ai Auth: signup and login.
POST /api/auth/register — body: { email, password, name? }
POST /api/auth/login    — body: { email, password }

Returns: { access_token, workspace_id, plan, email } or { error }
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.supabase_client import (
    is_configured,
    auth_signup,
    auth_signin,
    create_workspace_for_user,
    get_workspace_by_owner,
)


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }


def _handle(request, path: str):
    if getattr(request, "method", None) == "OPTIONS":
        return {"statusCode": 200, "headers": {**_cors_headers()}, "body": ""}

    if getattr(request, "method", None) != "POST":
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

    try:
        body = getattr(request, "body", None)
        if isinstance(body, bytes):
            body = body.decode("utf-8")
        if not body:
            body = "{}"
        data = json.loads(body)
    except (TypeError, ValueError):
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Invalid JSON body"}),
        }

    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    if not email or "@" not in email:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Valid email is required"}),
        }
    if not password or len(password) < 6:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Password must be at least 6 characters"}),
        }

    if path == "register" or path == "auth/register":
        # Sign up
        out = auth_signup(email, password)
        if out.get("error"):
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", **_cors_headers()},
                "body": json.dumps({"error": out["error"]}),
            }
        user = out.get("user") or {}
        uid = user.get("id")
        if not uid:
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json", **_cors_headers()},
                "body": json.dumps({"error": "Signup succeeded but user id missing"}),
            }
        # Create workspace for new user
        name = (data.get("name") or "").strip() or "My Workspace"
        workspace = create_workspace_for_user(uid, name=name or "My Workspace")
        session = out.get("session") or {}
        access_token = session.get("access_token")
        if not access_token:
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json", **_cors_headers()},
                "body": json.dumps({"error": "Session missing"}),
            }
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({
                "access_token": access_token,
                "workspace_id": workspace["id"] if workspace else None,
                "plan": workspace.get("plan", "free") if workspace else "free",
                "email": email,
            }),
        }

    # Login
    out = auth_signin(email, password)
    if out.get("error"):
        return {
            "statusCode": 401,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": out["error"]}),
        }
    access_token = out.get("access_token")
    user = out.get("user") or {}
    uid = user.get("id")
    workspace = get_workspace_by_owner(uid) if uid else None
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", **_cors_headers()},
        "body": json.dumps({
            "access_token": access_token,
            "workspace_id": workspace["id"] if workspace else None,
            "plan": workspace.get("plan", "free") if workspace else "free",
            "email": email,
        }),
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        result = _handle(type("Req", (), {"method": "OPTIONS", "body": None})(), "")
        self._send(result)

    def do_POST(self):
        path = (self.path or "").strip().rstrip("/").split("?")[0]
        if path.endswith("/login"):
            path = "login"
        elif path.endswith("/register"):
            path = "register"
        else:
            path = "login"  # default
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b""
        if isinstance(body, bytes):
            body = body.decode("utf-8")
        req = type("Req", (), {"method": "POST", "body": body, "headers": self.headers})()
        result = _handle(req, path)
        self._send(result)

    def _send(self, result):
        self.send_response(result["statusCode"])
        for k, v in result.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
        body = result.get("body", "")
        if body:
            self.wfile.write(body.encode("utf-8") if isinstance(body, str) else body)
