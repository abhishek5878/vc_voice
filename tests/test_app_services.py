"""
Tests for app.services (memo_fragment, universal_intake).
Run without VoiceVC app or DB. Use pytest -v tests/test_app_services.py
"""

import pytest

# Memo fragment (no DB)
try:
    from app.services.memo_fragment import (
        build_memo_fragment,
        build_memo_fragment_rule_based,
        score_to_priority,
        get_suggested_next_step,
        build_red_flags,
        build_signal_summary_bullets,
    )
    _MEMO_AVAILABLE = True
except ImportError:
    _MEMO_AVAILABLE = False

# Universal intake (no DB)
try:
    from app.services.universal_intake import (
        distill,
        detect_source_type,
        _extract_signals_with_evidence,
        _strip_meeting_noise,
    )
    _INTAKE_AVAILABLE = True
except ImportError:
    _INTAKE_AVAILABLE = False


@pytest.mark.skipif(not _MEMO_AVAILABLE, reason="app.services.memo_fragment not available")
class TestMemoFragment:
    def test_score_to_priority(self):
        assert score_to_priority(8, "recommend_meeting") == "High"
        assert score_to_priority(6, "recommend_if_bandwidth") == "Medium"
        assert score_to_priority(4, "refer_out") == "Low"

    def test_get_suggested_next_step(self):
        assert "intro" in get_suggested_next_step("High", "recommend_meeting").lower()
        assert get_suggested_next_step("Low", "do_not_recommend")  # non-empty

    def test_build_memo_fragment_rule_based(self):
        state = {
            "cumulative_ai_score": 0.3,
            "concrete_signals": {"traction": [{"value": "50 customers"}], "credentials": []},
            "ai_detection_history": [],
            "behavioral_history": [],
            "hardcoded_rejection": False,
            "hardcoded_rejection_reason": "",
        }
        evaluation = {"score": 7, "recommendation": "recommend_if_bandwidth", "rationale": [], "scoring_factors": []}
        memo = build_memo_fragment_rule_based(state, evaluation)
        assert "hook" in memo
        assert "signal_summary" in memo
        assert "red_flags" in memo
        assert memo["recommendation"]["priority"] in ("High", "Medium", "Low")
        assert "next_step" in memo["recommendation"]

    def test_build_memo_fragment_no_llm(self):
        state = {"concrete_signals": {"traction": [], "credentials": []}, "cumulative_ai_score": 0}
        evaluation = {"score": 5, "recommendation": "refer_out"}
        memo = build_memo_fragment(state, evaluation, api_key=None, persona_name="Test")
        assert "recommendation" in memo
        assert memo["recommendation"]["priority"] in ("High", "Medium", "Low")


@pytest.mark.skipif(not _INTAKE_AVAILABLE, reason="app.services.universal_intake not available")
class TestUniversalIntake:
    def test_strip_meeting_noise(self):
        t = "Hello [inaudible] world.  (crosstalk)  Multiple   spaces."
        out = _strip_meeting_noise(t)
        assert "[inaudible]" not in out
        assert "  " not in out or out.count("  ") < t.count("  ")

    def test_extract_signals_with_evidence(self):
        text = "We have 50 paying customers and $500k ARR. CAC is $200."
        signals = _extract_signals_with_evidence(text)
        assert len(signals) >= 1
        for s in signals:
            assert "type" in s and "value" in s and "evidence" in s

    def test_detect_source_type_transcript(self):
        text = "10:00 - Founder: We are building X. 10:05 - Investor: What's your retention?"
        assert detect_source_type(text, api_key=None) == "transcript"

    def test_detect_source_type_note(self):
        text = "- Bullet one\n- Bullet two\n- Bullet three\n- Bullet four"
        assert detect_source_type(text, api_key=None) == "note"

    def test_distill_empty(self):
        out = distill("", api_key=None, persona_name="Test")
        assert out["source_type"] in ("note", "transcript", "dictation")
        assert "evidence_log" in out and "blind_spots" in out
        assert "immediate_appraisal" in out

    def test_distill_granola_style(self):
        text = "Meeting notes: Founder said we have 100 customers and 20% MoM growth. Retention is 40%."
        out = distill(text, api_key=None, persona_name="Test", tool_hint="granola")
        assert out["source_type"] == "transcript"
        assert "evidence_log" in out
        assert "blind_spots" in out
        assert "questions_for_next_meeting" in out
        assert out["immediate_appraisal"]["hook"]
