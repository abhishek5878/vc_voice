"""
PI Triage System - Contact Intake Endpoint
POST /api/intake
"""

import json
import uuid
import os
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler

# Add lib to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.classification import classify_contact, get_classification_context
from lib.conversation import create_conversation, save_conversation
from lib.config import get_data_path
from lib.contacts_store import append_contact


def _handle(request):
    """Contact intake logic; returns dict with statusCode, headers, body."""

    # Handle CORS preflight
    if hasattr(request, 'method') and request.method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
            },
            'body': ''
        }

    # Check method
    if hasattr(request, 'method') and request.method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'})
        }

    try:
        # Parse request body
        if hasattr(request, 'body'):
            body = json.loads(request.body) if isinstance(request.body, str) else request.body
        elif hasattr(request, 'json'):
            body = request.json
        else:
            body = {}

        # Validate required fields
        name = body.get('name', '').strip()
        email = body.get('email', '').strip()
        current_work = body.get('current_work', '').strip()
        raising_status = (body.get('raising_status') or '').strip() or None   # raising | not_raising | exploring
        segment = (body.get('segment') or '').strip() or None   # B2B SMB | B2C | B2B enterprise | partnership | other

        if not name:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Name is required'})
            }

        if not email or '@' not in email:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Valid email is required'})
            }

        if not current_work:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Current work description is required'})
            }

        # Classify contact
        classification = classify_contact(email, current_work)

        # Generate conversation ID
        conversation_id = str(uuid.uuid4())

        # Create contact record (include raising_status, segment for thesis/fit gating)
        contact_data = {
            'conversation_id': conversation_id,
            'name': name,
            'email': email,
            'current_work': current_work,
            'raising_status': raising_status,
            'segment': segment,
            'classification': classification['combined_classification'],
            'email_domain': email.split('@')[1] if '@' in email else '',
            'country_hint': classification['country_hint'],
            'role_keywords': classification['role_keywords'],
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'pending'
        }

        try:
            append_contact(contact_data)
        except Exception:
            pass  # Don't fail if storage fails

        # Create conversation state
        state = create_conversation(conversation_id)
        state.contact_id = conversation_id

        # Build response
        response_data = {
            'conversation_id': conversation_id,
            'classification': classification['combined_classification'],
            'country_hint': classification['country_hint'],
            'confidence': classification['role_confidence'],
            'message': 'Contact information recorded. You may now begin the triage conversation.',
        }

        # Add warning for low-signal classifications
        if classification['warning']:
            response_data['warning'] = classification['warning']

        if classification['is_low_signal']:
            response_data['is_low_signal'] = True

        # Include classification context for the frontend
        response_data['classification_context'] = get_classification_context(classification)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
            },
            'body': json.dumps(response_data)
        }

    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        }


class handler(BaseHTTPRequestHandler):
    """Vercel Python runtime expects a class subclassing BaseHTTPRequestHandler."""

    def do_OPTIONS(self):
        result = {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
            },
            'body': ''
        }
        self._send(result)

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body_raw = self.rfile.read(content_length) if content_length else b''
        body_str = body_raw.decode('utf-8') if body_raw else '{}'
        req = type('Req', (), {'method': 'POST', 'body': body_str, 'headers': self.headers})()
        result = _handle(req)
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
        method = 'POST'
        body = json.dumps({
            'name': 'Test Founder',
            'email': 'test@startup.com',
            'current_work': 'Building a fintech product for SMBs. Raised 1.5Cr from Upekkha.'
        })

    result = _handle(MockRequest())
    print(json.dumps(json.loads(result['body']), indent=2))
