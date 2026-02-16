"""
Universal Intake API: bulk text (Granola notes / Wispr transcripts).
POST /api/v1/{tenant_slug}/intake/bulk → Immediate Appraisal.
Optional: create or update Lead with source_metadata and blind_spots.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import get_session
from app.models import Lead, Tenant
from app.services.universal_intake import distill

router = APIRouter(tags=["universal_intake"])


# =============================================================================
# Request / Response
# =============================================================================


class BulkIntakeRequest(BaseModel):
    """Bulk intake: single text or dual (transcript + dictation) for Conflict Reporting."""

    text: Optional[str] = Field(None, description="Single paste: Granola or Wispr (required if transcript_text+dictation_text not provided)")
    transcript_text: Optional[str] = Field(None, description="Granola transcript (fact-based); use with dictation_text for conflict check")
    dictation_text: Optional[str] = Field(None, description="Wispr dictation (self-reported); use with transcript_text for conflict check")
    tool_hint: Optional[str] = Field(None, description="granola | wispr (optional when using text)")
    conversation_id: Optional[str] = Field(None, description="If provided, update Lead with source_metadata, blind_spots, conflict_report")
    create_lead_if_missing: bool = Field(False, description="If True and conversation_id given but lead missing, create one")


class ImmediateAppraisalResponse(BaseModel):
    """Structured Immediate Appraisal with Markdown and Conflict Report."""

    source_type: str
    tool: str
    source_metadata: dict
    evidence_log: list
    unverified_signals: list
    blind_spots: list
    questions_for_next_meeting: list
    conflict_report: list
    immediate_appraisal: dict  # includes immediate_appraisal_markdown, grue_verdict, pedigree
    lead_updated: bool = False


# =============================================================================
# Endpoint
# =============================================================================


@router.post("/{tenant_slug}/intake/bulk", response_model=ImmediateAppraisalResponse)
def bulk_intake(
    tenant_slug: str,
    body: BulkIntakeRequest,
    session: Session = Depends(get_session),
) -> ImmediateAppraisalResponse:
    """
    Accept bulk text (Granola or Wispr) or dual input (transcript + dictation) for Conflict Reporting.
    Returns Immediate Appraisal with Markdown (Hook, Verified Signals, Blind Spots & Conflicts, GRUE verdict).
    Optionally updates Lead with source_metadata, blind_spots, conflict_report.
    """
    tenant = session.exec(select(Tenant).where(Tenant.slug == tenant_slug)).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant_slug}' not found")

    if (body.transcript_text or body.dictation_text) and not ((body.transcript_text or "").strip() and (body.dictation_text or "").strip()):
        raise HTTPException(status_code=400, detail="Provide both transcript_text and dictation_text for conflict reporting")

    text = (body.text or "").strip()
    if not text and not (body.transcript_text and body.dictation_text):
        raise HTTPException(status_code=400, detail="Provide text or both transcript_text and dictation_text")

    api_key = (tenant.openai_api_key or "").strip() if tenant else ""
    if not api_key or not api_key.startswith("sk-"):
        api_key = None

    persona_name = tenant.name or "the VC"
    result = distill(
        text=text or None,
        api_key=api_key,
        persona_name=persona_name,
        tool_hint=body.tool_hint,
        transcript_text=(body.transcript_text or "").strip() or None,
        dictation_text=(body.dictation_text or "").strip() or None,
    )

    lead_updated = False
    if body.conversation_id:
        lead = session.exec(
            select(Lead).where(
                Lead.tenant_id == tenant.id,
                Lead.conversation_id == body.conversation_id,
            )
        ).first()
        if lead:
            lead.source_metadata = result.get("source_metadata")
            lead.blind_spots = result.get("blind_spots")
            lead.conflict_report = result.get("conflict_report")
            session.add(lead)
            session.commit()
            lead_updated = True
        elif body.create_lead_if_missing:
            lead = Lead(
                tenant_id=tenant.id,
                conversation_id=body.conversation_id,
                status="active",
                source_metadata=result.get("source_metadata"),
                blind_spots=result.get("blind_spots"),
                conflict_report=result.get("conflict_report"),
            )
            session.add(lead)
            session.commit()
            lead_updated = True

    return ImmediateAppraisalResponse(
        source_type=result.get("source_type", "note"),
        tool=result.get("tool", "unknown"),
        source_metadata=result.get("source_metadata", {}),
        evidence_log=result.get("evidence_log", []),
        unverified_signals=result.get("unverified_signals", []),
        blind_spots=result.get("blind_spots", []),
        questions_for_next_meeting=result.get("questions_for_next_meeting", []),
        conflict_report=result.get("conflict_report", []),
        immediate_appraisal=result.get("immediate_appraisal", {}),
        lead_updated=lead_updated,
    )
