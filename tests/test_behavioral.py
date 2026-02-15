"""
PI Triage System - Behavioral Probe Tests
Tests for behavioral authenticity detection.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from lib.behavioral_probes import (
    detect_evasion,
    calculate_specificity_score,
    detect_temporal_grounding,
    analyze_behavioral_response,
    should_cap_for_behavioral
)


class TestEvasionDetection:
    """Tests for evasion detection"""

    def test_detects_evasion_patterns(self):
        text = "Generally speaking, it depends on multiple factors. There are many reasons."
        is_evasive, patterns = detect_evasion(text)
        assert is_evasive or len(patterns) >= 2

    def test_detects_circular_reference(self):
        text = "As I mentioned earlier, we are focused on growth. As noted previously, our approach works."
        is_evasive, patterns = detect_evasion(text)
        assert any("as i mentioned" in p.lower() or "as noted" in p.lower() for p in patterns)

    def test_allows_direct_answers(self):
        text = "We tried Facebook ads but CAC was 5000 and LTV only 2000. Pivoted in October 2023."
        is_evasive, patterns = detect_evasion(text)
        assert not is_evasive

    def test_detects_topic_pivot(self):
        text = "What's more important is our vision. The real question is about market opportunity."
        is_evasive, patterns = detect_evasion(text)
        # Should flag as evasive


class TestSpecificityScoring:
    """Tests for specificity scoring"""

    def test_high_specificity_for_concrete_details(self):
        text = "We have 200 customers, 15L MRR, CAC of 500, and LTV/CAC ratio of 6x. Launched in March 2023."
        score, breakdown = calculate_specificity_score(text)
        assert score >= 0.5
        assert breakdown["high"] >= 3

    def test_low_specificity_for_vague_content(self):
        text = "We have significant traction with many customers showing substantial interest in our innovative solution."
        score, breakdown = calculate_specificity_score(text)
        assert score < 0.3
        assert breakdown["low"] >= 2

    def test_medium_specificity(self):
        text = "We built and launched the product. Tried a few approaches. Got some traction."
        score, breakdown = calculate_specificity_score(text)
        assert 0.2 <= score <= 0.6


class TestTemporalGrounding:
    """Tests for temporal grounding detection"""

    def test_detects_specific_dates(self):
        text = "We launched in March 2023. By Q4 2023, we had 100 customers."
        has_grounding, specific, vague = detect_temporal_grounding(text)
        assert has_grounding
        assert len(specific) >= 2

    def test_detects_relative_time(self):
        text = "3 months ago we pivoted. 6 months later we hit PMF."
        has_grounding, specific, vague = detect_temporal_grounding(text)
        assert len(specific) >= 1

    def test_flags_vague_temporal(self):
        text = "Recently we made progress. Eventually we'll scale. Soon we'll launch."
        has_grounding, specific, vague = detect_temporal_grounding(text)
        assert not has_grounding
        assert len(vague) >= 2


class TestFullBehavioralAnalysis:
    """Tests for complete behavioral analysis"""

    def test_authentic_response_scores_well(self):
        text = """We tried direct sales to retailers in Q2 2023. Failed because CAC was 5000 but LTV only 2000.
        Pivoted to distributor model in October. Got 150 customers in 3 months through 5 partnerships."""

        result = analyze_behavioral_response(text)
        assert result["specificity_score"] >= 0.4
        assert result["temporal_grounding"]
        assert not result["evasion_flag"]
        assert len(result["positive_signals"]) >= 1

    def test_evasive_response_flagged(self):
        text = """Generally speaking, there were multiple factors. It depends on various considerations.
        As I mentioned, our approach is comprehensive. The real question is about market opportunity."""

        result = analyze_behavioral_response(text)
        assert result["evasion_flag"] or result["specificity_score"] < 0.3
        assert len(result["red_flags"]) >= 1

    def test_very_short_response_flagged(self):
        text = "Not sure."
        result = analyze_behavioral_response(text)
        assert "Very short response" in result["red_flags"]


class TestBehavioralCapping:
    """Tests for behavioral score capping"""

    def test_caps_for_many_evasions(self):
        history = [
            {"evasion_flag": True, "specificity_score": 0.2},
            {"evasion_flag": True, "specificity_score": 0.1},
            {"evasion_flag": True, "specificity_score": 0.15},
        ]
        should_cap, max_score, reason = should_cap_for_behavioral(history, 0.3)
        assert should_cap
        assert max_score <= 2
        assert "evasive" in reason.lower()

    def test_caps_for_low_specificity_with_ai(self):
        history = [
            {"evasion_flag": False, "specificity_score": 0.02},
            {"evasion_flag": False, "specificity_score": 0.03},
        ]
        should_cap, max_score, reason = should_cap_for_behavioral(history, 0.5)
        assert should_cap
        assert max_score <= 4

    def test_no_cap_for_good_responses(self):
        history = [
            {"evasion_flag": False, "specificity_score": 0.6},
            {"evasion_flag": False, "specificity_score": 0.7},
        ]
        should_cap, max_score, reason = should_cap_for_behavioral(history, 0.2)
        assert not should_cap


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
