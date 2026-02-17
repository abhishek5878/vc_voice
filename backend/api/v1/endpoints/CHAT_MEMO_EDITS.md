# Chat API: Include memo_fragment in response

Apply these edits to `app/api/v1/endpoints/chat.py`.

## 1. Add `memo_fragment` to `ChatResponse` model

```python
class ChatResponse(BaseModel):
    message: str
    turn_count: int
    evaluation_complete: bool = False
    evaluation: Optional[dict] = None
    memo_fragment: Optional[dict] = None  # When evaluation_complete: hook, red_flags, verdict
    signals: dict
    ai_detection_this_turn: Optional[dict] = None
```

## 2. Include in return when building `ChatResponse`

When you build the response, pass through the memo fragment when evaluation is complete:

```python
    return ChatResponse(
        message=result["message"],
        turn_count=result["turn_count"],
        evaluation_complete=result.get("evaluation_complete", False),
        evaluation=result.get("evaluation"),
        memo_fragment=result.get("evaluation", {}).get("memo_fragment") if result.get("evaluation_complete") else None,
        signals=result.get("signals", {"traction_count": 0, "credential_count": 0, "strength": "none"}),
        ai_detection_this_turn=result.get("ai_detection_this_turn"),
    )
```
