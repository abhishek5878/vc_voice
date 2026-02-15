# Paste these into app/api/v1/endpoints/chat.py (VoiceVC)
# ---------------------------------------------------------------------------

# 1) In ChatResponse model, ADD:
    memo_fragment: Optional[dict] = None  # When evaluation_complete: hook, red_flags, verdict

# 2) In the return ChatResponse(...) call, ADD the argument:
        memo_fragment=result.get("evaluation", {}).get("memo_fragment") if result.get("evaluation_complete") else None,
