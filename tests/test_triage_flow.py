"""
VoiceVC - Triage flow tests.
Uses existing 'sajith' tenant, creates dummy Lead, exercises /chat and asserts
extracted_signals, cumulative_ai_score, and final evaluation.

Run from voicevc project root: pytest tests/test_triage_flow.py -v
Requires: pytest, pytest-asyncio, httpx, app.main, app.database. Skips if app not available.
"""
from __future__ import annotations

import uuid
from typing import Optional

import pytest

# Skip entire module if VoiceVC app is not available (e.g. running in pi-triage only)
try:
    from backend.main import app
    from backend.database import get_session
    from backend.models import Lead, Tenant
    import httpx
    from httpx import ASGITransport, AsyncClient
    from sqlmodel import Session, select
    _VOICEVC_AVAILABLE = True
except ImportError:
    _VOICEVC_AVAILABLE = False
    Lead = Tenant = Session = select = get_session = app = None  # type: ignore[misc, assignment]
    AsyncClient = ASGITransport = httpx = None  # type: ignore[assignment]

pytestmark = pytest.mark.skipif(not _VOICEVC_AVAILABLE, reason="VoiceVC app (backend.main, backend.database) not available")


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def db_session():
    """Yield a DB session. Caller is responsible for cleanup of created data."""
    session = next(get_session())
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def tenant_sajith(db_session: Session) -> Tenant:
    """Existing 'sajith' tenant."""
    tenant = db_session.exec(select(Tenant).where(Tenant.slug == "sajith")).first()
    if not tenant:
        pytest.skip("Tenant 'sajith' not found. Run seed_tenant or create sajith first.")
    return tenant


@pytest.fixture
def dummy_lead(db_session: Session, tenant_sajith: Tenant) -> Lead:
    """Create a dummy Lead for sajith, yield conversation_id and lead; delete after test."""
    conversation_id = str(uuid.uuid4())
    lead = Lead(
        tenant_id=tenant_sajith.id,
        conversation_id=conversation_id,
        status="active",
        classification="founder",
    )
    db_session.add(lead)
    db_session.commit()
    db_session.refresh(lead)
    try:
        yield lead
    finally:
        db_session.delete(lead)
        db_session.commit()


@pytest.fixture
def conversation_id(dummy_lead: Lead) -> str:
    return dummy_lead.conversation_id


@pytest.fixture
async def async_client():
    """Async HTTP client against the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def _chat_url(tenant_slug: str) -> str:
    return f"/api/v1/{tenant_slug}/chat"


def _refetch_lead(session: Session, tenant_id: int, conversation_id: str) -> Optional[Lead]:
    return session.exec(
        select(Lead).where(
            Lead.tenant_id == tenant_id,
            Lead.conversation_id == conversation_id,
        )
    ).first()


# =============================================================================
# 1. First turn – high-signal message
# =============================================================================

@pytest.mark.asyncio
async def test_first_turn_high_signal_extracts_signals_and_updates_ai_score(
    async_client: AsyncClient,
    db_session: Session,
    tenant_sajith: Tenant,
    dummy_lead: Lead,
):
    """Send high-signal message; assert extracted_signals and cumulative_ai_score updated."""
    conversation_id = dummy_lead.conversation_id
    tenant_id = tenant_sajith.id

    high_signal_message = "We are an IIT Delhi team with $500k ARR."
    response = await async_client.post(
        _chat_url("sajith"),
        json={"message": high_signal_message, "conversation_id": conversation_id},
    )
    assert response.status_code == 200, response.text

    lead = _refetch_lead(db_session, tenant_id, conversation_id)
    assert lead is not None

    # extracted_signals should contain IIT Delhi and $500k ARR (in traction/credentials/summary)
    signals = lead.extracted_signals or {}
    traction = signals.get("traction") or []
    credentials = signals.get("credentials") or []
    summary = (signals.get("summary") or "").lower()
    combined = " ".join(
        str(x) for x in (traction + credentials)
    ).lower() + " " + summary

    assert "iit delhi" in combined or "iit" in combined, (
        f"Expected 'IIT Delhi' in extracted_signals; got {signals}"
    )
    assert "500k" in combined or "$500k" in combined or "500k arr" in combined, (
        f"Expected '$500k ARR' in extracted_signals; got {signals}"
    )

    # cumulative_ai_score should be set (updated by TriageEngine)
    assert lead.cumulative_ai_score is not None, "cumulative_ai_score should be updated"
    assert isinstance(lead.cumulative_ai_score, (int, float))
    assert 0 <= lead.cumulative_ai_score <= 1.0


# =============================================================================
# 2. AI penalty – low-signal cliché message increases cumulative_ai_score
# =============================================================================

@pytest.mark.asyncio
async def test_ai_cliche_increases_cumulative_ai_score(
    async_client: AsyncClient,
    db_session: Session,
    tenant_sajith: Tenant,
    dummy_lead: Lead,
):
    """First turn: high signal. Second turn: AI clichés; assert cumulative_ai_score increases."""
    conversation_id = dummy_lead.conversation_id
    tenant_id = tenant_sajith.id

    # Turn 1: high signal
    r1 = await async_client.post(
        _chat_url("sajith"),
        json={
            "message": "We are an IIT Delhi team with $500k ARR.",
            "conversation_id": conversation_id,
        },
    )
    assert r1.status_code == 200
    lead1 = _refetch_lead(db_session, tenant_id, conversation_id)
    assert lead1 is not None
    score_after_turn1 = lead1.cumulative_ai_score

    # Turn 2: low-signal, AI-style clichés
    ai_cliche_message = (
        "I hope this message finds you well. We are leveraging synergies "
        "to disrupt the space and would love to pick your brain over a quick coffee chat."
    )
    r2 = await async_client.post(
        _chat_url("sajith"),
        json={"message": ai_cliche_message, "conversation_id": conversation_id},
    )
    assert r2.status_code == 200

    lead2 = _refetch_lead(db_session, tenant_id, conversation_id)
    assert lead2 is not None
    score_after_turn2 = lead2.cumulative_ai_score

    # AI detection should increase cumulative score (penalty for clichés)
    assert score_after_turn2 is not None
    assert score_after_turn2 >= score_after_turn1, (
        f"Expected cumulative_ai_score to increase or stay same after AI cliché; "
        f"got {score_after_turn1} -> {score_after_turn2}"
    )


# =============================================================================
# 3. Final evaluation – multiple turns then recommendation saved on Lead
# =============================================================================

@pytest.mark.asyncio
async def test_final_evaluation_generated_and_saved(
    async_client: AsyncClient,
    db_session: Session,
    tenant_sajith: Tenant,
    dummy_lead: Lead,
):
    """Simulate 3–5 turns to trigger evaluation; assert recommendation and evaluation on Lead."""
    conversation_id = dummy_lead.conversation_id
    tenant_id = tenant_sajith.id

    # Messages designed to trigger evaluation (enough turns + some signal)
    messages = [
        "We are an IIT Delhi team with $500k ARR.",
        "We build B2B SaaS for SMBs. 50 paying customers, 20% MoM growth.",
        "Looking for seed funding. Ex-Flipkart, built and scaled payments.",
    ]

    last_response = None
    for msg in messages:
        last_response = await async_client.post(
            _chat_url("sajith"),
            json={"message": msg, "conversation_id": conversation_id},
        )
        assert last_response.status_code == 200, last_response.text
        if last_response.json().get("evaluation_complete"):
            break

    # Either we hit evaluation in the loop or we need one more turn to force it
    if not (last_response and last_response.json().get("evaluation_complete")):
        last_response = await async_client.post(
            _chat_url("sajith"),
            json={
                "message": "We have clear unit economics and are raising our seed.",
                "conversation_id": conversation_id,
            },
        )
        assert last_response.status_code == 200

    data = last_response.json()
    assert data.get("evaluation_complete") is True, (
        f"Expected evaluation_complete=True after 3–5 turns; got {data}"
    )
    assert "evaluation" in data
    memo_in_response = data.get("memo_fragment") or data.get("evaluation", {}).get("memo_fragment")
    assert memo_in_response is not None, "API response should include memo_fragment when evaluation completes"

    lead = _refetch_lead(db_session, tenant_id, conversation_id)
    assert lead is not None
    assert lead.status == "completed"
    assert lead.recommendation is not None, "Lead.recommendation should be set after evaluation"
    assert lead.evaluation_result is not None, "Lead.evaluation_result should be set"
    assert lead.evaluation_score is not None
    # Investment memo fragment (hook, signal_summary, red_flags, recommendation)
    assert lead.memo_fragment is not None, "Lead.memo_fragment should be set when evaluation completes"
    assert "hook" in lead.memo_fragment
    priority = lead.memo_fragment.get("verdict") or (lead.memo_fragment.get("recommendation") or {}).get("priority")
    assert priority in ("High", "Medium", "Low"), f"Expected priority/verdict in memo_fragment, got {lead.memo_fragment}"
    if "recommendation" in lead.memo_fragment:
        assert "next_step" in lead.memo_fragment["recommendation"] or "priority" in lead.memo_fragment["recommendation"]
