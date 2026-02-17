"""
Robin.ai — Skeptical Principal Architecture (SPA) 4-Layer Pipeline.
Formats and runs Layer 1 (SEL), Layer 2 (Conflict Reporter), Layer 3 (GRUE Stress-Test),
Layer 4 (Conviction Interrogation: Red List, Yellow List, Pedigree Check).
"""

from typing import Any, Dict, List, Optional

# =============================================================================
# LAYER 3 — GRUE Stress-Test: Full domain checklist (from spec)
# =============================================================================

GRUE_SPA_DOMAINS = {
    "GROWTH": [
        "MoM/YoY revenue growth rate",
        "Customer Acquisition Cost (CAC)",
        "Lead velocity / pipeline coverage",
        "Channel breakdown and payback by channel",
    ],
    "RETENTION": [
        "Net Revenue Retention (NRR)",
        "Logo/customer churn rate",
        "LTV and cohort analysis",
        "Expansion revenue and upsell motion",
    ],
    "UNIT ECONOMICS": [
        "Gross margin",
        "LTV:CAC ratio",
        "Payback period",
        "Burn multiple",
        "Rule of 40",
    ],
    "QUALITATIVE MOAT": [
        "Product differentiation vs. named competitors",
        "Network effects, switching costs, IP",
        "Defensibility of market position",
    ],
    "TEAM & EXECUTION": [
        "Founder-market fit evidence",
        "Prior exits or domain experience",
        "Key hires present and gaps acknowledged",
    ],
}

# Map legacy signal names to SPA metric labels for coverage
SIGNAL_TO_GRUE_METRIC = {
    "retention": "Logo/customer churn rate",
    "retention_pct": "Logo/customer churn rate",
    "d90_retention": "Net Revenue Retention (NRR)",
    "arr": "MoM/YoY revenue growth rate",
    "mrr": "MoM/YoY revenue growth rate",
    "revenue": "MoM/YoY revenue growth rate",
    "cac": "Customer Acquisition Cost (CAC)",
    "ltv": "LTV and cohort analysis",
    "ltv_cac": "LTV:CAC ratio",
    "churn": "Logo/customer churn rate",
    "growth": "MoM/YoY revenue growth rate",
    "mom": "MoM/YoY revenue growth rate",
    "customers": "Lead velocity / pipeline coverage",
    "users": "Lead velocity / pipeline coverage",
}

# Reverse: for each SPA metric, which signal prefixes (from evidence_log) count as coverage
def _signal_covers_metric(signal: str, metric: str) -> bool:
    """True if this evidence signal covers the given SPA metric."""
    sig = (signal or "").lower()
    metric_lower = metric.lower()
    for prefix, mapped_metric in SIGNAL_TO_GRUE_METRIC.items():
        if mapped_metric.lower() != metric_lower:
            continue
        if sig == prefix or sig.startswith(prefix + "_") or prefix in sig:
            return True
    return _metric_matches(metric, signal)


def format_layer1_sel(
    evidence_log: List[Dict[str, Any]],
    conflict_report: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Layer 1 — Semantic Evidence Logs (SEL).
    Output format per claim: CLAIM, SOURCE, STATUS (Verified / Unverified / Contradicted).
    """
    contradicted_signals = set()
    if conflict_report:
        for c in conflict_report:
            if c.get("conflict_type") in ("factual", "A"):
                m = (c.get("metric") or c.get("transcript_value") or "").strip()
                if m:
                    # signal is e.g. "retention_retention_pct" or "revenue_arr"
                    parts = str(m).replace(":", "_").split("_")
                    if parts:
                        contradicted_signals.add(parts[0].strip())

    sel = []
    for e in evidence_log or []:
        claim = f"{e.get('signal', '')}: {e.get('value', '')}".strip() or "Unspecified claim"
        source = (e.get("evidence") or "").strip()
        if not source:
            status = "Unverified"
        elif e.get("signal", "").split("_")[0] in contradicted_signals:
            status = "Contradicted"
        elif e.get("verified"):
            status = "Verified"
        else:
            status = "Unverified"
        sel.append({
            "claim": claim,
            "source": source or "[UNVERIFIED — no source quote]",
            "status": status,
        })
    return sel


def format_layer2_conflicts(
    conflict_report: List[Dict[str, Any]],
    transcript_text: Optional[str] = None,
    dictation_text: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Layer 2 — Conflict Reporter.
    Output: CONFLICT TYPE (A/B/C), STREAM 1, STREAM 2, SEVERITY, WHY IT MATTERS.
    """
    out = []
    for c in conflict_report or []:
        ctype = c.get("conflict_type", "factual")
        if ctype in ("A", "factual"):
            type_label = "A"
        elif ctype in ("B", "tonal"):
            type_label = "B"
        elif ctype in ("C", "omission"):
            type_label = "C"
        else:
            type_label = "A"
        stream1 = (c.get("stream_1") or c.get("transcript_value") or c.get("transcript_quote") or "").strip()
        stream2 = (c.get("stream_2") or c.get("dictation_value") or c.get("dictation_quote") or "").strip()
        if not stream1 and c.get("summary"):
            stream1 = c.get("summary", "").split("—")[0].strip() or "Public transcript"
        if not stream2 and ctype == "omission":
            stream2 = c.get("summary", "Not in transcript")
        severity = c.get("severity") or "Medium"
        why = c.get("why_it_matters") or c.get("summary") or "Cross-stream inconsistency."
        out.append({
            "conflict_type": type_label,
            "stream_1": stream1[:500] if stream1 else "[public transcript]",
            "stream_2": stream2[:500] if stream2 else "[private dictation]",
            "severity": severity,
            "why_it_matters": why[:400],
        })
    return out


def format_layer3_grue(
    evidence_log: List[Dict[str, Any]],
    blind_spots: List[str],
    text: str,
) -> List[Dict[str, Any]]:
    """
    Layer 3 — GRUE Stress-Test.
    Output per metric: MENTIONED ✓ / UNDERSPECIFIED ⚠ / MISSING ✗ with source quote where applicable.
    """
    results = []
    for domain, metrics in GRUE_SPA_DOMAINS.items():
        for metric in metrics:
            found_verified = False
            found_vague = False
            quote = ""
            for e in evidence_log or []:
                if not _signal_covers_metric(e.get("signal", ""), metric):
                    continue
                ev = (e.get("evidence") or e.get("value") or "").strip()
                if e.get("verified") and ev:
                    found_verified = True
                    quote = ev[:200]
                    break
                elif ev or e.get("value"):
                    found_vague = True
                    if ev:
                        quote = ev[:200]
            if found_verified and quote:
                results.append({"metric": metric, "status": "MENTIONED", "symbol": "✓", "quote": quote})
            elif found_vague:
                results.append({"metric": metric, "status": "UNDERSPECIFIED", "symbol": "⚠", "quote": quote or "mentioned vaguely, no data"})
            else:
                results.append({"metric": metric, "status": "MISSING", "symbol": "✗", "quote": "THIS IS A BLIND SPOT."})
    return results


def _metric_matches(metric: str, signal: str) -> bool:
    signal = (signal or "").lower()
    metric_lower = metric.lower()
    if "retention" in metric_lower or "nrr" in metric_lower:
        if "retention" in signal or "nrr" in signal or "churn" in signal:
            return True
    if "churn" in metric_lower and "churn" in signal:
        return True
    if "arr" in metric_lower or "mrr" in metric_lower or "revenue" in metric_lower:
        if "arr" in signal or "mrr" in signal or "revenue" in signal:
            return True
    if "cac" in metric_lower and "cac" in signal:
        return True
    if "ltv" in metric_lower and "ltv" in signal:
        return True
    if "growth" in metric_lower or "lead velocity" in metric_lower or "pipeline" in metric_lower or "channel" in metric_lower:
        if "growth" in signal or "mom" in signal or "customers" in signal or "users" in signal:
            return True
    if "margin" in metric_lower or "payback" in metric_lower or "burn" in metric_lower or "rule of 40" in metric_lower:
        if "unit_economics" in signal or "ltv_cac" in signal or "cac" in signal or "cm2" in signal:
            return True
    if "expansion" in metric_lower or "upsell" in metric_lower:
        if "retention" in signal or "revenue" in signal:
            return True
    if "differentiation" in metric_lower or "competitor" in metric_lower or "moat" in metric_lower or "defensibility" in metric_lower:
        return False  # no direct signal key; leave as MISSING unless we add later
    if "founder" in metric_lower or "team" in metric_lower or "hire" in metric_lower or "exit" in metric_lower:
        return False
    return False


def build_layer4_interrogation(
    evidence_log: List[Dict[str, Any]],
    blind_spots: List[str],
    conflict_report: List[Dict[str, Any]],
    questions_for_next_meeting: List[str],
    pedigree: Optional[Dict[str, Any]],
    grue_results: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Layer 4 — Conviction Interrogation Engine.
    Returns red_list (3-5 existential), yellow_list (5-10 depth), pedigree_check.
    Every item linked to SOURCE FINDING.
    """
    red_list: List[Dict[str, Any]] = []
    yellow_list: List[Dict[str, Any]] = []

    # Red: highest-severity — conflicts, critical blind spots (retention, unit economics)
    critical_blind = [b for b in (blind_spots or []) if b in ("retention", "arr", "mrr", "cac", "ltv", "ltv_cac", "churn")]
    for b in critical_blind[:3]:
        q = _blind_spot_to_question(b)
        red_list.append({
            "question": q,
            "source_finding": f"Layer 3 GRUE — {b} not mentioned (MISSING ✗)",
            "why_existential": f"Without clear {b}, the deal is not investable today.",
        })
    for c in (conflict_report or [])[:2]:
        if c.get("severity") == "High" or c.get("conflict_type") in ("A", "factual"):
            s1 = (c.get("stream_1") or c.get("transcript_value") or "")[:80]
            s2 = (c.get("stream_2") or c.get("dictation_value") or "")[:80]
            red_list.append({
                "question": f"Resolve discrepancy: {(c.get('summary') or c.get('why_it_matters') or '')[:120]}",
                "source_finding": f"Layer 2 Conflict ({c.get('conflict_type', 'A')}) — {s1} vs {s2}",
                "why_existential": "Contradiction between transcript and your notes must be resolved.",
            })

    # Yellow: depth — other blind spots and unverified
    unverified = [e for e in (evidence_log or []) if not e.get("verified")]
    for u in unverified[:5]:
        cq = u.get("counter_question") or f"Clarify or provide number for: {u.get('signal', '')}"
        yellow_list.append({
            "question": cq,
            "source_finding": f"Layer 1 SEL — claim unverified: {u.get('signal', '')}",
        })
    for b in (blind_spots or []):
        if b not in critical_blind:
            yellow_list.append({
                "question": _blind_spot_to_question(b),
                "source_finding": f"Layer 3 GRUE — {b} not addressed",
            })
    seen_questions = {y.get("question", "").strip() for y in yellow_list}
    for q in (questions_for_next_meeting or [])[:5]:
        if len(yellow_list) >= 10:
            break
        qstr = (q if isinstance(q, str) else "").strip()
        if qstr and qstr not in seen_questions:
            seen_questions.add(qstr)
            yellow_list.append({
                "question": qstr,
                "source_finding": "Layer 1/3 — missing or unverified metric",
            })

    red_list = red_list[:5]
    yellow_list = yellow_list[:10]

    pedigree_check: List[Dict[str, Any]] = []
    if pedigree and pedigree.get("high_pedigree"):
        pedigree_check.append({
            "pedigree_flag": f"High-pedigree tags: {', '.join(pedigree.get('pedigree_tags', []))}",
            "severity": "Low",
        })

    return {
        "red_list": red_list,
        "yellow_list": yellow_list,
        "pedigree_check": pedigree_check,
    }


def build_pre_meeting_attack_brief(
    red_list: List[Dict[str, Any]],
    yellow_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Mode 2 — Pre-Meeting Attack Brief.
    Red List framed as: "They will not have a good answer to this. Probe hard."
    Yellow List framed as: "This is where you separate polish from preparation."
    Plus recommended sequence for maximum strategic effect.
    """
    red_framed = [
        {
            "question": r.get("question", ""),
            "source_finding": r.get("source_finding", ""),
            "framing": "They will not have a good answer to this. Probe hard.",
        }
        for r in red_list
    ]
    yellow_framed = [
        {
            "question": y.get("question", ""),
            "source_finding": y.get("source_finding", ""),
            "framing": "This is where you separate polish from preparation.",
        }
        for y in yellow_list
    ]
    # Recommended sequence: Red first (existential), then Yellow (depth)
    recommended_sequence = [f"Red {i+1}: {r.get('question', '')[:80]}…" for i, r in enumerate(red_list)]
    recommended_sequence += [f"Yellow {i+1}: {y.get('question', '')[:80]}…" for i, y in enumerate(yellow_list[:5])]
    return {
        "red_list_framed": red_framed,
        "yellow_list_framed": yellow_framed,
        "recommended_sequence": recommended_sequence,
    }


def _blind_spot_to_question(metric: str) -> str:
    if metric == "retention":
        return "What's your retention curve? D90 retention?"
    if metric in ("arr", "mrr", "revenue"):
        return "Current ARR/MRR? Revenue number?"
    if metric in ("cac", "ltv", "ltv_cac"):
        return "What's your CAC and LTV/CAC?"
    if metric == "churn":
        return "Monthly churn rate?"
    if metric == "growth":
        return "What is MoM or YoY growth percentage?"
    if metric in ("customers", "users"):
        return "Exact paying customer or user count?"
    return f"Provide core metric: {metric} (GRUE framework)."


# =============================================================================
# Start Protocol — exact message for every new conversation
# =============================================================================

ROBIN_START_PROTOCOL = """Robin.ai active.

I'm your Cognitive Firewall — not your note-taker.

Three modes. Tell me which one you need:

  1️⃣  POST-MEETING ANALYSIS
     Paste your transcript + any private voice notes.
     I'll run the full intelligence pipeline: claim extraction,
     conflict detection, blind spot analysis, and your interrogation brief.

  2️⃣  PRE-MEETING PREP
     Give me what you have on the founder before the meeting.
     I'll build your attack brief — the exact questions to ask and in what order.

  3️⃣  PITCH STRESS-TEST
     You're the founder. Submit your pitch.
     I'll run Robin's full analysis silently — then I'll interrogate you
     with everything I found. Expect it to be uncomfortable.
     That's the point.

Pro tip: If you give me both a public meeting transcript AND a private
voice note, I will cross-reference them for conflicts you haven't
consciously noticed yet. That's usually where the real signal lives.

What are we analyzing?"""


# =============================================================================
# Conviction Score — only when explicitly requested
# =============================================================================

def build_conviction_score(
    grue_verdict: str,
    evidence_log: List[Dict[str, Any]],
    blind_spots: List[str],
    conflict_report: List[Dict[str, Any]],
    pedigree: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    CONVICTION SCORE [1–10], RATIONALE, CRITICAL BLOCKERS, CURRENT INVESTABILITY.
    Generate only when explicitly requested.
    """
    verified = [e for e in (evidence_log or []) if e.get("verified")]
    verdict_to_score = {"High": 7, "Medium": 5, "Low": 3}
    base = verdict_to_score.get(grue_verdict, 3)
    if conflict_report:
        base = max(1, base - 2)
    if (blind_spots or []):
        base = max(1, base - 1)
    if pedigree and pedigree.get("high_pedigree"):
        base = min(10, base + 1)
    score = min(10, max(1, base))

    blockers = []
    for b in (blind_spots or [])[:5]:
        blockers.append(f"{b} not stated or unverified")
    for c in (conflict_report or [])[:3]:
        blockers.append(c.get("summary", "Cross-stream conflict")[:80])

    if score <= 3:
        investability = "Not investable — fundamental gaps unresolved"
    elif score <= 5:
        investability = "Conditional — investable if [specific conditions] are met"
    elif score <= 7:
        investability = "Investable with reservations — [specific reservations named]"
    else:
        investability = "Strong conviction — evidence supports the thesis"

    rationale = f"GRUE verdict: {grue_verdict}. Verified signals: {len(verified)}. Blind spots: {len(blind_spots or [])}. Conflicts: {len(conflict_report or [])}."

    return {
        "conviction_score": score,
        "score_rationale": rationale,
        "critical_blockers": blockers,
        "current_investability": investability,
    }


# =============================================================================
# Run full SPA pipeline (format distill output per spec)
# =============================================================================

def run_spa_formatter(
    distill_result: Dict[str, Any],
    mode: int = 1,
    transcript_text: Optional[str] = None,
    dictation_text: Optional[str] = None,
    include_conviction: bool = False,
) -> Dict[str, Any]:
    """
    Takes output of distill(); returns 4-layer SPA formatted output.
    mode 1 = Post-Meeting (all 4 layers), mode 2 = Pre-Meeting (no Layer 2), mode 3 = same but for stress-test.
    """
    evidence_log = distill_result.get("evidence_log") or []
    blind_spots = distill_result.get("blind_spots") or []
    conflict_report = distill_result.get("conflict_report") or []
    questions = distill_result.get("questions_for_next_meeting") or []
    pedigree = distill_result.get("pedigree")
    appraisal = distill_result.get("immediate_appraisal") or {}
    grue_verdict = appraisal.get("grue_verdict", "Low")

    text = transcript_text or dictation_text or ""
    if not text and distill_result.get("granola_preview"):
        text = distill_result.get("granola_preview", "")

    # Layer 1 — SEL
    sel = format_layer1_sel(evidence_log, conflict_report)

    # Layer 2 — Conflict (skip in mode 2)
    conflicts_formatted = []
    if mode != 2:
        conflicts_formatted = format_layer2_conflicts(
            conflict_report, transcript_text, dictation_text
        )

    # Layer 3 — GRUE
    grue_results = format_layer3_grue(evidence_log, blind_spots, text)

    # Layer 4 — Interrogation
    layer4 = build_layer4_interrogation(
        evidence_log, blind_spots, conflict_report, questions, pedigree, grue_results
    )

    out = {
        "mode": mode,
        "layer_1_sel": sel,
        "layer_2_conflict_report": conflicts_formatted,
        "layer_3_grue_stress_test": grue_results,
        "layer_4_red_list": layer4["red_list"],
        "layer_4_yellow_list": layer4["yellow_list"],
        "layer_4_pedigree_check": layer4["pedigree_check"],
        "immediate_appraisal": appraisal,
        "evidence_log": evidence_log,
        "blind_spots": blind_spots,
        "questions_for_next_meeting": questions,
    }

    if mode == 2:
        out["pre_meeting_attack_brief"] = build_pre_meeting_attack_brief(
            layer4["red_list"], layer4["yellow_list"]
        )

    if include_conviction:
        out["conviction"] = build_conviction_score(
            grue_verdict, evidence_log, blind_spots, conflict_report, pedigree
        )

    return out
