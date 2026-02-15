"""
VoiceVC - SQLModel models.
Lead includes memo_fragment for the Investment Memo Fragment feature.
"""

from typing import Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class Tenant(SQLModel, table=True):
    __tablename__ = "tenant"

    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: Optional[str] = None
    openai_api_key: Optional[str] = None
    calendly_url: Optional[str] = None


class Lead(SQLModel, table=True):
    __tablename__ = "lead"

    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenant.id")
    conversation_id: str = Field(index=True)
    status: str = "active"
    classification: Optional[str] = None

    conversation_state: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    cumulative_ai_score: Optional[float] = None
    extracted_signals: Optional[dict] = Field(default=None, sa_column=Column(JSON))

    evaluation_score: Optional[int] = None
    evaluation_result: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    recommendation: Optional[str] = None
    memo_fragment: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class TenantSettings(SQLModel, table=True):
    __tablename__ = "tenant_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenant.id")
    max_turns: int = 5
    min_turns_for_evaluation: int = 3
    auth_immediate_reject_ai: float = 0.7
    auth_immediate_reject_score: int = 1
    auth_cap_ai: float = 0.5
    auth_cap_score: int = 2
    auth_warn_ai: float = 0.3
    auth_warn_score: int = 4
    evasion_rejection_count: int = 3
    evasion_rejection_score: int = 2
    low_specificity_threshold: float = 0.05
    low_specificity_ai_threshold: float = 0.4
    low_specificity_score: int = 4
    behavioral_penalty_multiplier: float = 0.15
    immediate_rejection_similarity: float = 0.96
    downgrade_similarity: float = 0.92
    downgrade_penalty: int = 2
    signal_boost_count: int = 3
    signal_boost_value: int = 1
    do_not_recommend_threshold: int = 4
    refer_out_threshold: int = 6
    recommend_if_bandwidth_threshold: int = 7
    ai_phrases: Optional[list] = Field(default=None, sa_column=Column(JSON))
