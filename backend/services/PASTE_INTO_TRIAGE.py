# Paste these into app/services/triage.py (VoiceVC)
# ---------------------------------------------------------------------------
# Automated Analyst Memo Generator: tenant-aware LLM memo when api_key + persona_name provided.

# 1) At top with other imports:
from backend.services.memo_fragment import build_memo_fragment

# 2) In _run_full_evaluation, REPLACE the final "return { ... }" with:
#    (Build result, then generate memo using Tenant's API key and persona name for tenant-aware prompt.)

        result = {
            **llm_eval,
            "score": scoring["final_score"],
            "recommendation": scoring["recommendation"],
            "recommendation_text": scoring["recommendation_text"],
            "authenticity_score": scoring["authenticity_score"],
            "quality_score": scoring["quality_score"],
            "scoring_factors": scoring["combined_factors"],
            "original_llm_score": llm_score,
        }
        api_key = self._get_api_key()
        persona_name = self._get_persona_name()
        result["memo_fragment"] = build_memo_fragment(
            state, result, api_key=api_key, persona_name=persona_name
        )
        return result

# 3) In process_message, when evaluation is complete, ADD after lead.evaluation_result = evaluation:
            lead.memo_fragment = evaluation.get("memo_fragment")
