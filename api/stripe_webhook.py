"""
POST /api/stripe_webhook — Stripe webhook for subscription lifecycle.
Handles: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted.
Updates workspace plan and Stripe ids. No CORS; Stripe sends from server.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.supabase_client import update_workspace_plan, is_configured


def _handle(request):
    if getattr(request, "method", None) != "POST":
        return {"statusCode": 405, "headers": {}, "body": ""}

    payload_raw = getattr(request, "body", b"")
    if isinstance(payload_raw, str):
        payload_raw = payload_raw.encode("utf-8")
    sig = ""
    if hasattr(request, "headers") and hasattr(request.headers, "get"):
        sig = request.headers.get("Stripe-Signature", "")

    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
    if not secret:
        return {"statusCode": 503, "headers": {}, "body": json.dumps({"error": "Webhook not configured"})}

    import stripe
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    try:
        event = stripe.Webhook.construct_event(payload_raw, sig, secret)
    except ValueError:
        return {"statusCode": 400, "headers": {}, "body": json.dumps({"error": "Invalid payload"})}
    except Exception as e:
        return {"statusCode": 400, "headers": {}, "body": json.dumps({"error": "Invalid signature"})}

    workspace_id = None
    plan = "solo"
    stripe_customer_id = None
    stripe_subscription_id = None

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        workspace_id = session.get("client_reference_id") or (session.get("metadata") or {}).get("workspace_id")
        stripe_customer_id = session.get("customer")
        stripe_subscription_id = session.get("subscription")
        if workspace_id and is_configured():
            update_workspace_plan(workspace_id, plan, stripe_customer_id=stripe_customer_id, stripe_subscription_id=stripe_subscription_id)

    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        stripe_subscription_id = sub.get("id")
        status = (sub.get("status") or "").lower()
        if status in ("active", "trialing"):
            plan = "solo"
        else:
            plan = "free"
        # We need workspace_id from subscription metadata or from our DB by stripe_subscription_id
        # Stripe subscription doesn't have client_reference_id; we'd need to store workspace_id in subscription metadata when creating. For now, look up workspace by stripe_subscription_id.
        if is_configured():
            from lib.supabase_client import get_workspace_by_id
            import httpx
            url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
            key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            if url and key:
                r = httpx.get(
                    f"{url}/rest/v1/workspaces",
                    params={"stripe_subscription_id": f"eq.{stripe_subscription_id}", "limit": "1"},
                    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    timeout=10,
                )
                if r.status_code == 200 and isinstance(r.json(), list) and r.json():
                    workspace_id = r.json()[0].get("id")
                    if workspace_id:
                        update_workspace_plan(workspace_id, plan, stripe_subscription_id=stripe_subscription_id)

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        stripe_subscription_id = sub.get("id")
        plan = "free"
        if is_configured():
            import httpx
            url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
            key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            if url and key:
                r = httpx.get(
                    f"{url}/rest/v1/workspaces",
                    params={"stripe_subscription_id": f"eq.{stripe_subscription_id}", "limit": "1"},
                    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    timeout=10,
                )
                if r.status_code == 200 and isinstance(r.json(), list) and r.json():
                    workspace_id = r.json()[0].get("id")
                    if workspace_id:
                        update_workspace_plan(workspace_id, plan)

    return {"statusCode": 200, "headers": {"Content-Type": "application/json"}, "body": json.dumps({"received": True})}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b""
        req = type("Req", (), {"method": "POST", "body": body, "headers": self.headers})()
        result = _handle(req)
        self.send_response(result["statusCode"])
        for k, v in result.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
        b = result.get("body", "")
        if b:
            self.wfile.write(b.encode("utf-8") if isinstance(b, str) else b)
