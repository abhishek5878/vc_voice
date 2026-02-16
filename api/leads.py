"""
PI Triage - Leads API (for VC dashboard: list, override, verify claims).
GET /api/leads -> list all leads (for export/tuning).
POST /api/leads -> body: { action, ... } for override or verify_claim.
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.contacts_store import get_all_leads, get_contact_by_conversation_id, update_contact


def _handle(request):
    method = getattr(request, "method", "GET")
    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": "",
        }
    if method == "GET":
        # List leads (for export / tuning)
        include_pending = True
        leads = get_all_leads(include_pending=include_pending)
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"leads": leads}),
        }
    if method == "POST":
        # Body: { action: "override" | "verify_claim", ... }
        try:
            body = getattr(request, "body", None)
            if isinstance(body, bytes):
                body = body.decode("utf-8")
            data = json.loads(body or "{}")
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Invalid JSON"}),
            }
        action = data.get("action")
        conversation_id = data.get("conversation_id")
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
        if action == "override":
            override = data.get("override")  # "approved" | "rejected"
            reason = data.get("reason", "")
            if override not in ("approved", "rejected"):
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                    "body": json.dumps({"error": "override must be 'approved' or 'rejected'"}),
                }
            update_contact(conversation_id, {"override": override, "override_reason": reason})
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"ok": True, "override": override}),
            }
        if action == "verify_claim":
            claim_index = data.get("claim_index")
            verified = data.get("verified")
            if claim_index is None or verified is None:
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                    "body": json.dumps({"error": "claim_index and verified required"}),
                }
            claims_verification = contact.get("claims_verification") or []
            if not isinstance(claims_verification, list):
                claims_verification = []
            while len(claims_verification) <= claim_index:
                claims_verification.append({"claim": "", "verified": None})
            claims_verification[claim_index]["verified"] = bool(verified)
            update_contact(conversation_id, {"claims_verification": claims_verification})
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"ok": True}),
            }
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "action must be 'override' or 'verify_claim'"}),
        }
    return {
        "statusCode": 405,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"error": "Method not allowed"}),
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        result = _handle(self)
        self._send(result)

    def do_GET(self):
        result = _handle(self)
        self._send(result)

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body_raw = self.rfile.read(content_length) if content_length else b""
        req = type("Req", (), {"method": "POST", "body": body_raw, "headers": self.headers})()
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
