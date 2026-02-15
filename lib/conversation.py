"""
PI Triage System - Conversation State Management
Manages in-memory conversation state for stateless serverless functions.
"""

import json
import uuid
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime


@dataclass
class AIDetectionResult:
    """Result from a single AI detection run."""
    score: float
    flags: List[str]
    phrase_count: int = 0
    structure_count: int = 0
    length_chars: int = 0
    patterns_detected: List[str] = field(default_factory=list)


@dataclass
class BehavioralAnalysis:
    """Result from behavioral analysis of a response."""
    specificity_score: float  # 0-1
    evasion_flag: bool
    temporal_grounding: bool
    red_flags: List[str] = field(default_factory=list)


@dataclass
class ConcreteSignals:
    """Extracted concrete signals from conversation."""
    traction: List[Dict[str, str]] = field(default_factory=list)
    credentials: List[Dict[str, str]] = field(default_factory=list)

    @property
    def total_count(self) -> int:
        return len(self.traction) + len(self.credentials)


@dataclass
class Evaluation:
    """Final evaluation result."""
    score: int
    authenticity_score: int
    quality_score: int
    recommendation: str
    rationale: List[str]
    suggested_meeting_focus: str = ""
    key_claims_to_verify: List[str] = field(default_factory=list)
    ai_detection_summary: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConversationState:
    """Full state of a triage conversation."""
    conversation_id: str
    contact_id: str
    messages: List[Dict[str, str]] = field(default_factory=list)  # [{"role": "user"/"assistant", "content": "..."}]
    turn_count: int = 0
    cumulative_ai_score: float = 0.0
    ai_detection_history: List[Dict[str, Any]] = field(default_factory=list)
    behavioral_history: List[Dict[str, Any]] = field(default_factory=list)
    concrete_signals: Dict[str, Any] = field(default_factory=lambda: {"traction": [], "credentials": []})
    archetype_analysis: Dict[str, Any] = field(default_factory=dict)
    evaluation: Optional[Dict[str, Any]] = None
    hardcoded_rejection: bool = False
    hardcoded_rejection_reason: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def add_user_message(self, content: str) -> None:
        """Add a user message and increment turn count."""
        self.messages.append({"role": "user", "content": content})
        self.turn_count += 1
        self.updated_at = datetime.utcnow().isoformat()

    def add_assistant_message(self, content: str) -> None:
        """Add an assistant (PI) message."""
        self.messages.append({"role": "assistant", "content": content})
        self.updated_at = datetime.utcnow().isoformat()

    def add_ai_detection(self, result: Dict[str, Any]) -> None:
        """Record AI detection result for this turn."""
        self.ai_detection_history.append({
            "turn": self.turn_count,
            **result
        })

    def add_behavioral_analysis(self, result: Dict[str, Any]) -> None:
        """Record behavioral analysis for this turn."""
        self.behavioral_history.append({
            "turn": self.turn_count,
            **result
        })

    def add_signal(self, signal_type: str, signal: Dict[str, str]) -> None:
        """Add a concrete signal (traction or credential)."""
        if signal_type in self.concrete_signals:
            self.concrete_signals[signal_type].append(signal)

    def get_evasion_count(self) -> int:
        """Count total evasions across all turns."""
        return sum(1 for b in self.behavioral_history if b.get("evasion_flag", False))

    def get_avg_specificity(self) -> float:
        """Get average specificity score across all turns."""
        if not self.behavioral_history:
            return 0.5
        scores = [b.get("specificity_score", 0.5) for b in self.behavioral_history]
        return sum(scores) / len(scores)

    def get_signal_count(self) -> int:
        """Get total concrete signal count."""
        return (
            len(self.concrete_signals.get("traction", [])) +
            len(self.concrete_signals.get("credentials", []))
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConversationState":
        """Create from dictionary."""
        return cls(**data)

    def get_transcript(self) -> str:
        """Get conversation transcript as formatted string."""
        lines = []
        for msg in self.messages:
            role = "User" if msg["role"] == "user" else "PI"
            lines.append(f"{role}: {msg['content']}")
        return "\n\n".join(lines)


# In-memory storage for conversation states
# In production, this would be replaced with Redis or similar
_conversation_store: Dict[str, ConversationState] = {}


def create_conversation(contact_id: str) -> ConversationState:
    """Create a new conversation state."""
    conversation_id = str(uuid.uuid4())
    state = ConversationState(
        conversation_id=conversation_id,
        contact_id=contact_id
    )
    _conversation_store[conversation_id] = state
    return state


def get_conversation(conversation_id: str) -> Optional[ConversationState]:
    """Get existing conversation state."""
    return _conversation_store.get(conversation_id)


def save_conversation(state: ConversationState) -> None:
    """Save conversation state."""
    _conversation_store[state.conversation_id] = state


def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation state."""
    if conversation_id in _conversation_store:
        del _conversation_store[conversation_id]
        return True
    return False


def encode_state_for_client(state: ConversationState) -> str:
    """Encode conversation state for client-side storage (stateless mode)."""
    return json.dumps(state.to_dict())


def decode_state_from_client(encoded: str) -> ConversationState:
    """Decode conversation state from client-side storage."""
    data = json.loads(encoded)
    return ConversationState.from_dict(data)
