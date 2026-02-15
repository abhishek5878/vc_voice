"""
PI Triage System - LLM Evaluation Module
Handles OpenAI API calls for conversation responses and final evaluation.
"""

import json
import httpx
from typing import Dict, List, Any, Optional, Tuple
from .config import OPENAI_MODEL, OPENAI_EMBEDDING_MODEL, OPENAI_TIMEOUT, OPENAI_MAX_RETRIES
from .prompts import (
    PI_SYSTEM_PROMPT,
    get_turn_prompt,
    get_evaluation_prompt,
    build_chat_messages
)
from .scoring import run_full_scoring, should_force_evaluation


# ============================================================================
# OpenAI API Client
# ============================================================================

class OpenAIClient:
    """Simple OpenAI API client using httpx."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.openai.com/v1"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = OPENAI_MODEL,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Make a chat completion request.

        Returns:
            (response_text, full_response)
        """
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        async with httpx.AsyncClient(timeout=OPENAI_TIMEOUT) as client:
            for attempt in range(OPENAI_MAX_RETRIES + 1):
                try:
                    response = await client.post(
                        url,
                        json=payload,
                        headers=self._get_headers()
                    )
                    response.raise_for_status()
                    data = response.json()

                    content = data["choices"][0]["message"]["content"]
                    return content, data

                except httpx.TimeoutException:
                    if attempt == OPENAI_MAX_RETRIES:
                        raise
                    continue
                except httpx.HTTPStatusError as e:
                    if e.response.status_code >= 500 and attempt < OPENAI_MAX_RETRIES:
                        continue
                    raise

        raise Exception("Max retries exceeded")

    async def get_embedding(
        self,
        text: str,
        model: str = OPENAI_EMBEDDING_MODEL
    ) -> List[float]:
        """Get embedding for text."""
        url = f"{self.base_url}/embeddings"
        payload = {
            "model": model,
            "input": text
        }

        async with httpx.AsyncClient(timeout=OPENAI_TIMEOUT) as client:
            response = await client.post(
                url,
                json=payload,
                headers=self._get_headers()
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]


# ============================================================================
# Synchronous Wrapper (for Vercel compatibility)
# ============================================================================

def chat_completion_sync(
    api_key: str,
    messages: List[Dict[str, str]],
    model: str = OPENAI_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 1000
) -> Tuple[str, Dict[str, Any]]:
    """Synchronous chat completion using httpx."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    with httpx.Client(timeout=OPENAI_TIMEOUT) as client:
        for attempt in range(OPENAI_MAX_RETRIES + 1):
            try:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return content, data
            except httpx.TimeoutException:
                if attempt == OPENAI_MAX_RETRIES:
                    raise
            except httpx.HTTPStatusError as e:
                if e.response.status_code >= 500 and attempt < OPENAI_MAX_RETRIES:
                    continue
                raise

    raise Exception("Max retries exceeded")


def get_embedding_sync(
    api_key: str,
    text: str,
    model: str = OPENAI_EMBEDDING_MODEL
) -> List[float]:
    """Synchronous embedding request."""
    url = "https://api.openai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "input": text[:8000]  # Truncate to avoid token limits
    }

    with httpx.Client(timeout=OPENAI_TIMEOUT) as client:
        response = client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data["data"][0]["embedding"]


# ============================================================================
# PI Response Generation
# ============================================================================

def generate_pi_response(
    api_key: str,
    conversation_history: List[Dict[str, str]],
    turn_count: int,
    ai_detection_context: str = "",
    classification_context: str = ""
) -> str:
    """
    Generate PI's response to the user.

    Args:
        api_key: OpenAI API key
        conversation_history: List of messages [{"role": "user/assistant", "content": "..."}]
        turn_count: Current turn number
        ai_detection_context: Context about AI detection for this turn
        classification_context: Context about user classification

    Returns:
        PI's response message
    """
    # Build context
    additional_context = ""
    if classification_context:
        additional_context += f"\n[CLASSIFICATION]: {classification_context}\n"
    if ai_detection_context:
        additional_context += f"\n[AI DETECTION]: {ai_detection_context}\n"

    # Get turn-specific instructions
    turn_prompt = get_turn_prompt(turn_count)

    # Build messages
    messages = build_chat_messages(
        PI_SYSTEM_PROMPT + additional_context,
        conversation_history,
        turn_prompt,
        ai_detection_context
    )

    # Generate response
    response, _ = chat_completion_sync(
        api_key,
        messages,
        temperature=0.7,
        max_tokens=500  # Keep responses concise
    )

    return response.strip()


# ============================================================================
# Final Evaluation
# ============================================================================

def run_llm_evaluation(
    api_key: str,
    conversation_transcript: str,
    ai_detection_results: Dict[str, Any],
    behavioral_analysis: Dict[str, Any],
    concrete_signals: Dict[str, Any],
    archetype_analysis: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Run LLM-based final evaluation.

    Returns:
        {
            "score": int,
            "recommendation": str,
            "rationale": List[str],
            "suggested_meeting_focus": str,
            "key_claims_to_verify": List[str],
            "ai_detection": Dict
        }
    """
    prompt = get_evaluation_prompt(
        conversation_transcript,
        ai_detection_results,
        behavioral_analysis,
        concrete_signals,
        archetype_analysis
    )

    messages = [
        {"role": "system", "content": "You are an evaluation assistant. Respond only with valid JSON."},
        {"role": "user", "content": prompt}
    ]

    response, _ = chat_completion_sync(
        api_key,
        messages,
        temperature=0.3,  # Lower temperature for more consistent evaluation
        max_tokens=1000
    )

    # Parse JSON response
    try:
        # Try to extract JSON from response
        json_start = response.find("{")
        json_end = response.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            json_str = response[json_start:json_end]
            evaluation = json.loads(json_str)
        else:
            raise ValueError("No JSON found in response")
    except (json.JSONDecodeError, ValueError):
        # Fallback evaluation
        evaluation = {
            "score": 5,
            "recommendation": "refer_out",
            "rationale": ["Unable to parse LLM evaluation - using default"],
            "suggested_meeting_focus": "",
            "key_claims_to_verify": [],
            "ai_detection": {
                "likely_ai_generated": False,
                "confidence": "low",
                "red_flags": []
            }
        }

    return evaluation


# ============================================================================
# Post-Processing (CRITICAL - Override LLM with Hardcoded Rules)
# ============================================================================

def post_process_evaluation(
    llm_evaluation: Dict[str, Any],
    cumulative_ai_score: float,
    evasion_count: int,
    avg_specificity: float,
    behavioral_red_flags: int,
    concrete_signal_count: int,
    archetype_similarity: float,
    classification: str,
    hardcoded_rejection: bool = False,
    hardcoded_reason: str = ""
) -> Dict[str, Any]:
    """
    Post-process LLM evaluation with hardcoded rules.

    CRITICAL: Hardcoded rules OVERRIDE LLM output.
    """
    llm_score = llm_evaluation.get("score", 5)

    # Detect strong credentials
    has_strong_credentials = (
        concrete_signal_count >= 3 or
        "education" in str(llm_evaluation.get("rationale", [])).lower() or
        "iit" in str(llm_evaluation.get("rationale", [])).lower() or
        "stanford" in str(llm_evaluation.get("rationale", [])).lower()
    )

    # Run full scoring pipeline (applies all hardcoded rules)
    scoring_result = run_full_scoring(
        cumulative_ai_score=cumulative_ai_score,
        evasion_count=evasion_count,
        avg_specificity=avg_specificity,
        behavioral_red_flags=behavioral_red_flags,
        llm_score=llm_score,
        concrete_signal_count=concrete_signal_count,
        archetype_similarity=archetype_similarity,
        classification=classification,
        hardcoded_rejection=hardcoded_rejection,
        hardcoded_reason=hardcoded_reason,
        has_strong_credentials=has_strong_credentials
    )

    # Merge with LLM evaluation
    final_evaluation = {
        **llm_evaluation,
        "score": scoring_result["final_score"],
        "recommendation": scoring_result["recommendation"],
        "authenticity_score": scoring_result["authenticity_score"],
        "quality_score": scoring_result["quality_score"],
        "scoring_factors": scoring_result["combined_factors"],
        "recommendation_text": scoring_result["recommendation_text"],
        "hardcoded_override": scoring_result["final_score"] != llm_score,
        "original_llm_score": llm_score
    }

    return final_evaluation


# ============================================================================
# Full Evaluation Pipeline
# ============================================================================

def run_full_evaluation(
    api_key: str,
    conversation_state: Any,  # ConversationState
    classification: str = "unknown"
) -> Dict[str, Any]:
    """
    Run the complete evaluation pipeline.

    Args:
        api_key: OpenAI API key
        conversation_state: Full conversation state object
        classification: Contact classification

    Returns:
        Complete evaluation result
    """
    # Get transcript
    transcript = conversation_state.get_transcript()

    # Prepare AI detection summary
    ai_detection_summary = {
        "cumulative_score": conversation_state.cumulative_ai_score,
        "flags": [],
        "turn_scores": []
    }
    for detection in conversation_state.ai_detection_history:
        ai_detection_summary["flags"].extend(detection.get("flags", []))
        ai_detection_summary["turn_scores"].append(detection.get("current_score", 0))

    # Prepare behavioral summary
    behavioral_summary = {
        "evasion_count": conversation_state.get_evasion_count(),
        "avg_specificity": conversation_state.get_avg_specificity(),
        "has_temporal": any(
            b.get("temporal_grounding", False)
            for b in conversation_state.behavioral_history
        ),
        "red_flag_count": sum(
            len(b.get("red_flags", []))
            for b in conversation_state.behavioral_history
        )
    }

    # Prepare archetype summary
    archetype_summary = conversation_state.archetype_analysis or {
        "max_similarity": 0,
        "matched_archetype": None
    }

    # Run LLM evaluation
    llm_evaluation = run_llm_evaluation(
        api_key,
        transcript,
        ai_detection_summary,
        behavioral_summary,
        conversation_state.concrete_signals,
        archetype_summary
    )

    # Post-process with hardcoded rules
    final_evaluation = post_process_evaluation(
        llm_evaluation,
        conversation_state.cumulative_ai_score,
        behavioral_summary["evasion_count"],
        behavioral_summary["avg_specificity"],
        behavioral_summary["red_flag_count"],
        conversation_state.get_signal_count(),
        archetype_summary.get("max_similarity", 0),
        classification,
        conversation_state.hardcoded_rejection,
        conversation_state.hardcoded_rejection_reason
    )

    return final_evaluation


# ============================================================================
# Evaluation Trigger Check
# ============================================================================

def check_evaluation_trigger(
    turn_count: int,
    cumulative_ai_score: float,
    concrete_signal_count: int,
    min_turns: int = 3,
    max_turns: int = 5
) -> Tuple[bool, str]:
    """
    Check if evaluation should be triggered.

    Returns:
        (should_evaluate, reason)
    """
    return should_force_evaluation(
        turn_count,
        cumulative_ai_score,
        concrete_signal_count,
        max_turns
    )
