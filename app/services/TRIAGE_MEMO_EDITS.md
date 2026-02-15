# TriageEngine: Memo Fragment Integration

Apply these edits to `app/services/triage.py`.

## 1. Add import (top of file)

```python
from app.services.memo_fragment import build_memo_fragment
```

## 2. In `_run_full_evaluation` – before the `return` statement

After building the `return` dict (the one with `score`, `recommendation`, `recommendation_text`, etc.), build the memo fragment and add it to the result, then return:

```python
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
```

(Replace the existing `return { ... }` block with building `result`, then adding `memo_fragment`, then `return result`.)

## 3. In `process_message` – when evaluation is complete

After setting `lead.evaluation_result = evaluation`, add:

```python
            lead.memo_fragment = evaluation.get("memo_fragment")
```

So the block looks like:

```python
            lead.evaluation_score = evaluation["score"]
            lead.evaluation_result = evaluation
            lead.recommendation = evaluation.get("recommendation")
            lead.memo_fragment = evaluation.get("memo_fragment")
            lead.status = "completed"
```
