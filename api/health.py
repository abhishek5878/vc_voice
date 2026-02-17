"""
PI Triage System - Health Check Endpoint
GET /api/health
"""

import json
import sys
import os
from http.server import BaseHTTPRequestHandler

# Add lib to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.config import SYSTEM_VERSION, SYSTEM_NAME, get_calendly_url


def _handle(request):
    """Health check logic; returns dict with statusCode, headers, body."""
    if hasattr(request, 'method') and request.method != 'GET':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'})
        }

    response_data = {
        'status': 'healthy',
        'version': SYSTEM_VERSION,
        'system': SYSTEM_NAME,
        'openai_configured': False,
        'mode': 'byok',
        'message': 'System operational. Provide your API key to use Robin.',
        'calendly_url': get_calendly_url() or None,
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
        },
        'body': json.dumps(response_data)
    }


class handler(BaseHTTPRequestHandler):
    """Vercel Python runtime expects a class subclassing BaseHTTPRequestHandler."""

    def do_GET(self):
        req = type('Req', (), {'method': 'GET', 'body': None, 'headers': self.headers})()
        result = _handle(req)
        self._send(result)

    def do_OPTIONS(self):
        result = {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
            },
            'body': ''
        }
        self._send(result)

    def _send(self, result):
        self.send_response(result['statusCode'])
        for k, v in result.get('headers', {}).items():
            self.send_header(k, v)
        self.end_headers()
        body = result.get('body', '')
        if body:
            self.wfile.write(body.encode('utf-8') if isinstance(body, str) else body)


# For local testing
if __name__ == '__main__':
    class MockRequest:
        method = 'GET'

    result = _handle(MockRequest())
    print(json.dumps(json.loads(result['body']), indent=2))
