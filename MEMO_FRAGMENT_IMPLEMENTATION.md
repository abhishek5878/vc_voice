# Automated Memo Fragment – Implementation Summary

When `evaluation_complete` is True, the triage flow now generates a structured **Investment Memo Fragment** and stores it on the Lead and in the API response.

## 1. Lead model (`app/models.py`)

This repo’s `app/models.py` already defines `Lead` with `memo_fragment`. If you have your own models file, add:

```python
memo_fragment: Optional[dict] = Field(default=None, sa_column=Column(JSON))  # or None if not using SQLModel JSON column
```

Ensure `Optional` is imported from `typing`; use `Column, JSON` from `sqlalchemy` if using `sa_column`.

---

## 2. Memo fragment builder (`app/services/memo_fragment.py`)

Already added. It provides:

- **`build_memo_fragment(state, evaluation)`**  
  Returns:
  - **`hook`**: One sentence on why this founder is worth a look (from rationale/signals).
  - **`red_flags`**: List of AI-detection and behavioral anomalies (cumulative AI, evasion, red flags, scoring factors).
  - **`verdict`**: `"High"` | `"Medium"` | `"Low"` from score/recommendation.

---

## 3. TriageEngine (`app/services/triage.py`)

- **Import:**  
  `from app.services.memo_fragment import build_memo_fragment`

- **`_run_full_evaluation`:**  
  Build the evaluation dict as you do now, then add the memo and return:
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

- **`process_message`** (when evaluation is complete):  
  After setting `lead.evaluation_result = evaluation`, add:
  ```python
  lead.memo_fragment = evaluation.get("memo_fragment")
  ```

---

## 4. Chat API (`app/api/v1/endpoints/chat.py`)

- **`ChatResponse`:**  
  Add:
  ```python
  memo_fragment: Optional[dict] = None
  ```

- **Return value:**  
  When building `ChatResponse`, set:
  ```python
  memo_fragment=result.get("evaluation", {}).get("memo_fragment") if result.get("evaluation_complete") else None,
  ```

---

## 5. Example memo fragment (in response / on Lead)

```json
{
  "hook": "Worth a look: Strong credentials and concrete traction.",
  "red_flags": ["Moderate AI signals (0.45)"],
  "verdict": "Medium"
}
```

Verdict mapping: **High** (recommend_meeting / score ≥ 8), **Medium** (recommend_if_bandwidth or 6 ≤ score &lt; 8), **Low** (all others).
