#!/usr/bin/env python3
"""
PI Triage System - Local Development Server
Run this to test the system locally before deploying to Vercel.
"""

import http.server
import socketserver
import json
import os
import sys
from urllib.parse import parse_qs, urlparse

# Add lib to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load .env for OPENAI_API_KEY / GROQ_API_KEY
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

PORT = 3000


class PIRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom request handler for PI Triage API."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="static", **kwargs)

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        self.end_headers()

    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)

        if parsed.path == "/api/health":
            self.handle_health()
        elif parsed.path == "/" or parsed.path == "/index.html":
            self.path = "/index.html"
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        """Handle POST requests."""
        parsed = urlparse(self.path)

        if parsed.path == "/api/intake":
            self.handle_intake()
        elif parsed.path == "/api/chat":
            self.handle_chat()
        else:
            self.send_error(404, "Not Found")

    def handle_health(self):
        """Handle /api/health endpoint."""
        from api.health import handler

        class MockRequest:
            method = "GET"

        result = handler(MockRequest())
        self.send_json_response(result)

    def handle_intake(self):
        """Handle /api/intake endpoint."""
        from api.intake import handler

        body = self.read_body()

        class MockRequest:
            method = "POST"

        MockRequest.body = body
        result = handler(MockRequest())
        self.send_json_response(result)

    def handle_chat(self):
        """Handle /api/chat endpoint."""
        from api.chat import handler

        body = self.read_body()
        api_key = self.headers.get("X-API-Key", "")

        class MockHeaders:
            def get(self, key, default=""):
                if key.lower() == "x-api-key":
                    return api_key
                return default

        class MockRequest:
            method = "POST"
            headers = MockHeaders()

        MockRequest.body = body
        result = handler(MockRequest())
        self.send_json_response(result)

    def read_body(self):
        """Read request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(content_length).decode("utf-8")

    def send_json_response(self, result):
        """Send JSON response from handler result."""
        status_code = result.get("statusCode", 200)
        headers = result.get("headers", {})
        body = result.get("body", "{}")

        self.send_response(status_code)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def end_headers(self):
        """Add CORS headers to all responses."""
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


def main():
    """Run the local development server."""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    with socketserver.TCPServer(("", PORT), PIRequestHandler) as httpd:
        print(f"\n🚀 PI Triage System - Local Development Server")
        print(f"   Running at http://localhost:{PORT}")
        print(f"\n   API Endpoints:")
        print(f"   - GET  /api/health")
        print(f"   - POST /api/intake")
        print(f"   - POST /api/chat")
        print(f"\n   Press Ctrl+C to stop\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped.")


if __name__ == "__main__":
    main()
