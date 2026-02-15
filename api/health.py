"""
PI Triage System - Health Check Endpoint
GET /api/health
"""

import json
import sys
import os

# Add lib to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.config import SYSTEM_VERSION, SYSTEM_NAME


def handler(request):
    """Health check endpoint handler for Vercel."""

    # Check if request method is GET
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
        'openai_configured': False,  # BYOK mode - always false server-side
        'mode': 'byok',  # Bring Your Own Key
        'message': 'System operational. Provide your OpenAI API key to use the triage system.'
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


# For local testing
if __name__ == '__main__':
    class MockRequest:
        method = 'GET'

    result = handler(MockRequest())
    print(json.dumps(json.loads(result['body']), indent=2))
