"""
POST /api/create_checkout_session — create Stripe Checkout session for Solo plan.
Body: { workspace_id } (optional if from session). Requires Authorization: Bearer <token>.
Returns: { url } to redirect to Stripe Checkout, or { error }.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from lib.supabase_client import get_user_from_jwt, get_workspace_by_owner, get_workspace_by_id, is_configured


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    if getattr(request, "method", None) != "POST":
        return {
            "statusCode": 405,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Method not allowed"}),
        }

    stripe_key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    price_id = os.environ.get("STRIPE_PRICE_ID_SOLO", "").strip()
    if not stripe_key or not price_id:
        return {
            "statusCode": 503,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Billing not configured"}),
        }

    token = _get_bearer(request)
    if not token or not is_configured():
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

    try:
        body = getattr(request, "body", None)
        if isinstance(body, bytes):
            body = body.decode("utf-8")
        data = json.loads(body or "{}")
    except (TypeError, ValueError):
        data = {}
    workspace_id = (data.get("workspace_id") or "").strip()
    if not workspace_id:
        workspace = get_workspace_by_owner(user.get("sub"))
        workspace_id = workspace["id"] if workspace else None
    else:
        workspace = get_workspace_by_id(workspace_id)
    if not workspace_id or not workspace:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Workspace not found"}),
        }

    import stripe
    stripe.api_key = stripe_key
    frontend_url = (os.environ.get("FRONTEND_URL") or os.environ.get("VERCEL_URL") or "http://localhost:3000").strip()
    if not frontend_url.startswith("http"):
        frontend_url = "https://" + frontend_url
    success_url = f"{frontend_url}/app?checkout=success"
    cancel_url = f"{frontend_url}/app?checkout=canceled"

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=workspace_id,
            customer_email=user.get("email"),
            metadata={"workspace_id": workspace_id},
        )
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"url": session.url}),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", **_cors_headers()},
            "body": json.dumps({"error": "Checkout failed", "detail": str(e)}),
        }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        result = _handle(type("Req", (), {"method": "OPTIONS", "body": None, "headers": self.headers})())
        self._send(result)

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b""
        if isinstance(body, bytes):
            body = body.decode("utf-8")
        req = type("Req", (), {"method": "POST", "body": body, "headers": self.headers})()
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
