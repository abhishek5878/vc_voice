"""
PI Triage System - Chat Endpoint
POST /api/chat

Main endpoint for the triage conversation.
"""

import json
import uuid
import os
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler

# Add lib to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env so OPENAI_API_KEY (and GROQ_API_KEY) are available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from lib.conversation import (
    ConversationState,
    get_conversation,
    save_conversation,
    create_conversation,
    encode_state_for_client,
    decode_state_from_client
)
from lib.ai_detection import (
    run_ai_detection,
    should_reject_for_ai,
    get_ai_detection_response
)
from lib.behavioral_probes import (
    analyze_behavioral_response,
    calculate_behavioral_penalty,
    should_cap_for_behavioral,
    get_behavioral_probe_suggestion
)
from lib.signal_extraction import (
    extract_all_signals,
    get_signal_strength
)
from lib.archetype_similarity import (
    analyze_archetype,
    get_archetype_penalty
)
from lib.evaluation import (
    generate_pi_response,
    run_full_evaluation,
    check_evaluation_trigger,
    get_embedding_sync
)
from lib.config import (
    MIN_TURNS_FOR_EVALUATION,
    MAX_TURNS,
    AI_DETECTION
)


def get_api_key(request) -> str:
    """Extract API key from request headers."""
    if hasattr(request, 'headers'):
        # Try different header formats
        headers = request.headers
        if hasattr(headers, 'get'):
            return headers.get('X-API-Key', headers.get('x-api-key', ''))
        elif isinstance(headers, dict):
            return headers.get('X-API-Key', headers.get('x-api-key', ''))
    return ''


def validate_api_key(api_key: str) -> tuple:
    """Validate API key format."""
    if not api_key:
        return False, "API key is required. Please provide your OpenAI API key."

    if not api_key.startswith('sk-'):
        return False, "Invalid API key format. OpenAI API keys start with 'sk-'."

    if len(api_key) < 20:
        return False, "API key appears to be too short."

    return True, ""


def _handle(request):
    """Chat logic; returns dict with statusCode, headers, body."""

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
        # Get and validate API key
        api_key = get_api_key(request)
        is_valid, error_msg = validate_api_key(api_key)
        if not is_valid:
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': error_msg})
            }

        # Parse request body
        if hasattr(request, 'body'):
            body = json.loads(request.body) if isinstance(request.body, str) else request.body
        elif hasattr(request, 'json'):
            body = request.json
        else:
            body = {}

        # Extract fields
        user_message = body.get('message', '').strip()
        conversation_id = body.get('conversation_id', '')
        encoded_state = body.get('state', '')  # For stateless mode
        test_mode = body.get('test_mode', False)

        if not user_message:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Message is required'})
            }

        # Load or create conversation state
        state = None

        # Try to decode from client-provided state (stateless mode)
        if encoded_state:
            try:
                state = decode_state_from_client(encoded_state)
            except Exception:
                pass

        # Try to get from server memory
        if not state and conversation_id:
            state = get_conversation(conversation_id)

        # Create new state if none exists
        if not state:
            state = create_conversation(conversation_id or str(uuid.uuid4()))

        # ================================================================
        # STEP 1: Run AI Detection (BEFORE LLM sees the message)
        # ================================================================
        ai_detection = run_ai_detection(user_message, state.cumulative_ai_score)
        state.cumulative_ai_score = ai_detection['cumulative_score']
        state.add_ai_detection(ai_detection)

        # Check for immediate AI rejection
        should_reject, reject_reason = should_reject_for_ai(
            state.cumulative_ai_score,
            state.turn_count + 1,  # +1 because we haven't added the message yet
            state.get_signal_count()
        )

        if should_reject:
            state.hardcoded_rejection = True
            state.hardcoded_rejection_reason = reject_reason

        # ================================================================
        # STEP 2: Add User Message
        # ================================================================
        state.add_user_message(user_message)

        # ================================================================
        # STEP 3: Behavioral Analysis
        # ================================================================
        behavioral = analyze_behavioral_response(
            user_message,
            question_type="",  # Could be inferred from previous PI message
            previous_context=""
        )
        state.add_behavioral_analysis(behavioral)

        # Apply behavioral penalty to AI score
        behavioral_penalty = calculate_behavioral_penalty(
            state.behavioral_history,
            state.cumulative_ai_score
        )
        state.cumulative_ai_score = min(1.0, state.cumulative_ai_score + behavioral_penalty)

        # ================================================================
        # STEP 4: Signal Extraction
        # ================================================================
        signals = extract_all_signals(user_message)
        for signal in signals['traction']:
            state.add_signal('traction', signal)
        for signal in signals['credentials']:
            state.add_signal('credentials', signal)

        # ================================================================
        # STEP 5: Archetype Analysis
        # ================================================================
        # Only run embedding-based analysis if we have strong keyword match
        archetype = analyze_archetype(user_message)
        state.archetype_analysis = archetype.get('combined_assessment', {})

        # ================================================================
        # STEP 6: Check Evaluation Trigger
        # ================================================================
        should_evaluate, eval_reason = check_evaluation_trigger(
            state.turn_count,
            state.cumulative_ai_score,
            state.get_signal_count(),
            MIN_TURNS_FOR_EVALUATION,
            MAX_TURNS
        )

        # Force evaluation if hardcoded rejection
        if state.hardcoded_rejection:
            should_evaluate = True
            eval_reason = state.hardcoded_rejection_reason

        # ================================================================
        # STEP 7: Generate Response or Evaluation
        # ================================================================
        response_data = {
            'id': str(uuid.uuid4()),
            'conversation_id': state.conversation_id,
            'turn_count': state.turn_count,
            'evaluation_complete': False,
            'ai_detection_this_turn': {
                'score': ai_detection['current_score'],
                'cumulative': ai_detection['cumulative_score'],
                'flags': ai_detection['flags'][:3]  # Limit for response size
            }
        }

        if should_evaluate:
            # Run full evaluation
            try:
                evaluation = run_full_evaluation(
                    api_key,
                    state,
                    classification="unknown"  # Would come from intake
                )
                state.evaluation = evaluation
                response_data['evaluation_complete'] = True
                response_data['evaluation'] = evaluation

                # Generate final PI message based on evaluation
                if evaluation['score'] <= 4:
                    pi_message = f"Based on our conversation, I don't see a strong fit for a meeting with Sajith at this time. {evaluation.get('recommendation_text', '')}"
                elif evaluation['score'] <= 6:
                    pi_message = f"Thank you for sharing. {evaluation.get('recommendation_text', '')} I'd suggest exploring other resources that might be a better fit."
                else:
                    pi_message = f"This looks promising. {evaluation.get('recommendation_text', '')} I'll flag this for Sajith's review."

                response_data['message'] = pi_message

            except Exception as e:
                # If evaluation fails, continue conversation
                should_evaluate = False
                response_data['evaluation_error'] = str(e)

        if not should_evaluate:
            # Generate PI response
            ai_context = ""
            if ai_detection['action'] in ['warn', 'cap_score', 'reject']:
                ai_context = f"AI Detection Alert: {', '.join(ai_detection['flags'][:2])}"

            try:
                pi_message = generate_pi_response(
                    api_key,
                    state.messages[:-1],  # Exclude latest user message (already in prompt)
                    state.turn_count,
                    ai_context
                )

                # If AI was detected, potentially override response
                if ai_detection['action'] == 'reject' or state.cumulative_ai_score >= 0.6:
                    pi_message = get_ai_detection_response()

                state.add_assistant_message(pi_message)
                response_data['message'] = pi_message

            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': f'Failed to generate response: {str(e)}'
                    })
                }

        # Save state
        save_conversation(state)

        # Encode state for client (stateless mode)
        response_data['state'] = encode_state_for_client(state)

        # Add signal summary
        response_data['signals'] = {
            'traction_count': len(state.concrete_signals.get('traction', [])),
            'credential_count': len(state.concrete_signals.get('credentials', [])),
            'strength': get_signal_strength(state.get_signal_count(), state.turn_count)
        }

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
        import traceback
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': f'Internal server error: {str(e)}',
                'trace': traceback.format_exc() if os.environ.get('DEBUG') else None
            })
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
    import os
    os.environ['DEBUG'] = '1'

    class MockHeaders:
        def get(self, key, default=''):
            if key.lower() == 'x-api-key':
                return os.environ.get('OPENAI_API_KEY', 'sk-test-key')
            return default

    class MockRequest:
        method = 'POST'
        headers = MockHeaders()
        body = json.dumps({
            'message': "I'm building a fintech product for small retailers. 2 years in, 200 paying customers, 15L MRR. Raised 1.5Cr from Upekkha.",
            'conversation_id': 'test-123'
        })

    result = _handle(MockRequest())
    print(json.dumps(json.loads(result['body']), indent=2))
