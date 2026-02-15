# Paste these into app/services/triage.py (VoiceVC)
# ---------------------------------------------------------------------------

# 1) At top with other imports:
from app.services.memo_fragment import build_memo_fragment

# 2) In _run_full_evaluation, REPLACE the final "return { ... }" with:

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
        result["memo_fragment"] = build_memo_fragment(state, result)
        return result

# 3) In process_message, when evaluation is complete, ADD after lead.evaluation_result = evaluation:
            lead.memo_fragment = evaluation.get("memo_fragment")
