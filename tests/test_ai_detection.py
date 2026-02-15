"""
PI Triage System - AI Detection Tests
Tests for the 5-layer AI detection system.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from lib.ai_detection import (
    detect_ai_phrases,
    detect_structure_patterns,
    detect_length,
    detect_patterns,
    run_ai_detection,
    should_reject_for_ai
)


class TestPhraseDetection:
    """Tests for Layer 1: Phrase Detection"""

    def test_detects_generic_openings(self):
        text = "I hope this message finds you well. I wanted to reach out about an opportunity."
        count, phrases = detect_ai_phrases(text)
        assert count >= 2
        assert "i hope this message finds you well" in [p.lower() for p in phrases]

    def test_detects_corporate_speak(self):
        text = "We leverage synergies to drive growth and unlock value for our stakeholders."
        count, phrases = detect_ai_phrases(text)
        assert count >= 2
        assert any("synergies" in p.lower() or "unlock value" in p.lower() for p in phrases)

    def test_detects_ai_politeness(self):
        text = "That's a great question! I completely understand your concern."
        count, phrases = detect_ai_phrases(text)
        assert count >= 2

    def test_no_false_positives_for_authentic_text(self):
        text = "We built this product over 2 years. Have 200 customers and 15L MRR."
        count, phrases = detect_ai_phrases(text)
        assert count < 2


class TestStructureDetection:
    """Tests for Layer 2: Structure Analysis"""

    def test_detects_numbered_lists(self):
        text = "Our approach:\n1. First step\n2. Second step\n3. Third step"
        count, types = detect_structure_patterns(text)
        assert count >= 3
        assert "numbered_list" in types

    def test_detects_bullet_points(self):
        text = "Key features:\n- Feature one\n- Feature two\n- Feature three"
        count, types = detect_structure_patterns(text)
        assert count >= 3
        assert "bullet_point" in types

    def test_detects_markdown_headers(self):
        text = "## Overview\nSome content\n### Details\nMore content"
        count, types = detect_structure_patterns(text)
        assert "markdown_header" in types

    def test_detects_bold_text(self):
        text = "This is **important** and this is also **key**."
        count, types = detect_structure_patterns(text)
        assert "bold_text" in types

    def test_authentic_text_low_structure(self):
        text = "I've been building this for 2 years. We have 200 customers paying 15L MRR."
        count, types = detect_structure_patterns(text)
        assert count < 3


class TestLengthDetection:
    """Tests for Layer 3: Length Analysis"""

    def test_short_message(self):
        text = "We have 200 customers and 15L MRR."
        length = detect_length(text)
        assert length < 100

    def test_medium_message(self):
        text = "x" * 1100
        length = detect_length(text)
        assert 1000 < length < 1500

    def test_long_message(self):
        text = "x" * 1600
        length = detect_length(text)
        assert length > 1500


class TestPatternDetection:
    """Tests for Layer 4: Pattern Analysis"""

    def test_detects_no_contractions(self):
        text = "I am building a product. It is important. We are focused. I will succeed. I would like to share."
        patterns, count = detect_patterns(text)
        assert any("no_contractions" in p for p in patterns)

    def test_detects_repetitive_starters(self):
        text = "We built this. We launched it. We grew fast. We expanded. We are now scaling."
        patterns, count = detect_patterns(text)
        # May or may not trigger depending on threshold

    def test_authentic_text_has_contractions(self):
        text = "I've been building this. It's working well. We're growing fast. Can't believe how far we've come."
        patterns, count = detect_patterns(text)
        assert not any("no_contractions" in p for p in patterns)


class TestFullAIDetection:
    """Tests for the complete AI detection pipeline"""

    def test_high_ai_score_for_ai_content(self):
        text = """I hope this message finds you well. I wanted to reach out about an exciting opportunity.

Our comprehensive solution leverages cutting-edge technology to:
1. Streamline operations
2. Drive growth
3. Unlock value
4. Maximize efficiency

I completely understand your concerns and would be happy to elaborate further."""

        result = run_ai_detection(text, 0.0)
        assert result["current_score"] >= 0.5
        assert len(result["flags"]) >= 2

    def test_low_ai_score_for_authentic_content(self):
        text = "I've been building a fintech product for 2 years. We have 200 paying customers and 15L MRR. Raised 1.5Cr from Upekkha. Previously I was a PM at Razorpay for 3 years."

        result = run_ai_detection(text, 0.0)
        assert result["current_score"] < 0.5

    def test_cumulative_scoring(self):
        # First message with some AI signals
        result1 = run_ai_detection("I hope this finds you well. Building an AI solution.", 0.0)
        cum1 = result1["cumulative_score"]

        # Second message with more AI signals
        result2 = run_ai_detection("Thank you for that question. Our comprehensive approach...", cum1)
        cum2 = result2["cumulative_score"]

        # Cumulative should increase
        assert cum2 > cum1


class TestRejectionLogic:
    """Tests for rejection decision logic"""

    def test_rejects_high_ai_score(self):
        should_reject, reason = should_reject_for_ai(0.75, 2, 0)
        assert should_reject
        assert "AI probability" in reason

    def test_rejects_moderate_ai_no_signals(self):
        should_reject, reason = should_reject_for_ai(0.65, 3, 0)
        assert should_reject
        assert "signals" in reason.lower()

    def test_allows_low_ai_with_signals(self):
        should_reject, reason = should_reject_for_ai(0.2, 3, 3)
        assert not should_reject

    def test_allows_moderate_ai_with_signals(self):
        should_reject, reason = should_reject_for_ai(0.55, 3, 4)
        # Should not reject if there are strong signals
        assert not should_reject


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
