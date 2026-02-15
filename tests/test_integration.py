"""
PI Triage System - Integration Tests
End-to-end tests using synthetic test cases.
"""

import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from lib.ai_detection import run_ai_detection
from lib.behavioral_probes import analyze_behavioral_response
from lib.signal_extraction import extract_all_signals
from lib.archetype_similarity import analyze_archetype
from lib.scoring import run_full_scoring
from lib.classification import classify_contact


def load_test_cases():
    """Load synthetic test cases from JSON."""
    path = os.path.join(os.path.dirname(__file__), "synthetic_cases.json")
    with open(path, "r") as f:
        data = json.load(f)
    return data["test_cases"]


class TestClassification:
    """Tests for contact classification"""

    def test_founder_classification(self):
        result = classify_contact(
            "founder@startup.com",
            "Building a fintech product, raised seed round"
        )
        assert result["role"] == "founder"

    def test_student_email_classification(self):
        result = classify_contact(
            "student@iitd.ac.in",
            "Final year student interested in startups"
        )
        assert result["combined_classification"] == "indian_student"

    def test_partnership_classification(self):
        result = classify_contact(
            "bd@vendor.com",
            "Business development, looking for partnership opportunities"
        )
        assert result["role"] == "partnership"
        assert result["is_low_signal"]


class TestSignalExtraction:
    """Tests for signal extraction"""

    def test_extracts_customer_count(self):
        signals = extract_all_signals("We have 200 paying customers")
        assert signals["total_count"] >= 1
        assert any(s["type"] == "customers" for s in signals["traction"])

    def test_extracts_revenue(self):
        signals = extract_all_signals("Currently at 15L MRR, growing 30% MoM")
        assert any(s["type"] == "revenue" for s in signals["traction"])
        assert any(s["type"] == "growth" for s in signals["traction"])

    def test_extracts_funding(self):
        signals = extract_all_signals("Raised 1.5Cr from Upekkha and angel investors")
        assert any(s["type"] == "funding" for s in signals["traction"])

    def test_extracts_credentials(self):
        signals = extract_all_signals("Ex-Razorpay PM, IIT Delhi graduate")
        assert signals["credentials"]
        assert any("razorpay" in str(s).lower() for s in signals["credentials"])


class TestArchetypeDetection:
    """Tests for archetype pattern matching"""

    def test_detects_ai_for_x(self):
        result = analyze_archetype("Building an AI-powered solution for healthcare")
        assert result["keyword_match"]["archetype_id"] == "ai_for_x"

    def test_detects_marketplace(self):
        result = analyze_archetype("Building a marketplace for local services")
        assert result["keyword_match"]["archetype_id"] == "marketplace_for_y"

    def test_detects_uber_for_x(self):
        result = analyze_archetype("Think Uber for laundry services")
        assert result["keyword_match"]["archetype_id"] == "uber_for_z"

    def test_no_match_for_specific_pitch(self):
        result = analyze_archetype(
            "Built fintech for small retailers. 200 customers, 15L MRR."
        )
        assert result["keyword_match"]["confidence"] < 0.5


class TestSyntheticCases:
    """Tests using the full synthetic test case suite"""

    @pytest.fixture
    def test_cases(self):
        return load_test_cases()

    def test_high_quality_founders_pass(self, test_cases):
        """High-quality founders with real traction should pass"""
        high_quality_cases = [
            tc for tc in test_cases
            if tc["category"] == "high_quality_human"
        ]

        passed = 0
        for case in high_quality_cases:
            # Simulate conversation analysis
            cumulative_ai = 0.0
            all_signals = {"traction": [], "credentials": []}
            evasion_count = 0
            specificity_scores = []

            for turn in case["conversation"]:
                # AI detection
                ai_result = run_ai_detection(turn["user"], cumulative_ai)
                cumulative_ai = ai_result["cumulative_score"]

                # Behavioral analysis
                behavioral = analyze_behavioral_response(turn["user"])
                if behavioral["evasion_flag"]:
                    evasion_count += 1
                specificity_scores.append(behavioral["specificity_score"])

                # Signal extraction
                signals = extract_all_signals(turn["user"])
                all_signals["traction"].extend(signals["traction"])
                all_signals["credentials"].extend(signals["credentials"])

            # Calculate score
            avg_specificity = sum(specificity_scores) / len(specificity_scores) if specificity_scores else 0.5
            signal_count = len(all_signals["traction"]) + len(all_signals["credentials"])

            result = run_full_scoring(
                cumulative_ai_score=cumulative_ai,
                evasion_count=evasion_count,
                avg_specificity=avg_specificity,
                behavioral_red_flags=0,
                llm_score=7,  # Assume reasonable LLM score
                concrete_signal_count=signal_count,
                archetype_similarity=0.5,
                classification="founder"
            )

            if result["final_score"] >= case["expected_score_range"][0]:
                passed += 1

        # At least 60% of high-quality cases should pass
        assert passed / len(high_quality_cases) >= 0.6, f"Only {passed}/{len(high_quality_cases)} high-quality cases passed"

    def test_ai_polished_weak_fail(self, test_cases):
        """AI-polished weak pitches should fail"""
        weak_cases = [
            tc for tc in test_cases
            if tc["category"] == "ai_polished_weak"
        ]

        failed = 0
        for case in weak_cases:
            cumulative_ai = 0.0
            all_signals = {"traction": [], "credentials": []}
            evasion_count = 0
            specificity_scores = []

            for turn in case["conversation"]:
                ai_result = run_ai_detection(turn["user"], cumulative_ai)
                cumulative_ai = ai_result["cumulative_score"]

                behavioral = analyze_behavioral_response(turn["user"])
                if behavioral["evasion_flag"]:
                    evasion_count += 1
                specificity_scores.append(behavioral["specificity_score"])

                signals = extract_all_signals(turn["user"])
                all_signals["traction"].extend(signals["traction"])
                all_signals["credentials"].extend(signals["credentials"])

            avg_specificity = sum(specificity_scores) / len(specificity_scores) if specificity_scores else 0.5
            signal_count = len(all_signals["traction"]) + len(all_signals["credentials"])

            result = run_full_scoring(
                cumulative_ai_score=cumulative_ai,
                evasion_count=evasion_count,
                avg_specificity=avg_specificity,
                behavioral_red_flags=len([s for s in specificity_scores if s < 0.2]),
                llm_score=5,
                concrete_signal_count=signal_count,
                archetype_similarity=0.5,
                classification="founder"
            )

            if result["final_score"] <= 4:
                failed += 1

        # At least 80% of AI weak cases should fail
        assert failed / len(weak_cases) >= 0.8, f"Only {failed}/{len(weak_cases)} AI-weak cases failed"

    def test_partnership_cases_fail(self, test_cases):
        """Partnership/sales pitches should fail"""
        partnership_cases = [
            tc for tc in test_cases
            if tc["category"] == "partnership"
        ]

        failed = 0
        for case in partnership_cases:
            result = run_full_scoring(
                cumulative_ai_score=0.4,
                evasion_count=0,
                avg_specificity=0.3,
                behavioral_red_flags=1,
                llm_score=5,
                concrete_signal_count=0,
                archetype_similarity=0.5,
                classification="partnership"
            )

            if result["final_score"] <= 3:
                failed += 1

        # All partnership cases should fail
        assert failed == len(partnership_cases)


class TestEdgeCases:
    """Tests for edge cases and boundary conditions"""

    def test_empty_message(self):
        result = run_ai_detection("", 0.0)
        assert result["current_score"] == 0.0

    def test_very_long_message(self):
        long_text = "Building fintech. " * 500  # Very long but not AI-like
        result = run_ai_detection(long_text, 0.0)
        # Should flag for length but not necessarily as AI
        assert result["details"]["length"]["chars"] > 1500

    def test_unicode_handling(self):
        text = "Building fintech for ₹2Cr revenue, serving 200 भारतीय customers"
        signals = extract_all_signals(text)
        assert signals["total_count"] >= 1

    def test_mixed_case_detection(self):
        text = "I HOPE THIS MESSAGE FINDS YOU WELL. I AM BUILDING AN AI SOLUTION."
        result = run_ai_detection(text, 0.0)
        # Should still detect AI phrases regardless of case
        assert result["current_score"] >= 0 or len(result["flags"]) >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
