from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.models.advisory import AdvisoryResponse
from app.models.risk import RiskScoreResponse
from app.services.language import SUPPORTED_LANGUAGE_CODES

SupportedLanguage = Literal[
    "en", "hi", "bn", "te", "mr", "ta", "ur", "gu", "kn", "ml", "pa", "or"
]


class Location(BaseModel):
    lat: float = Field(..., description="Latitude in decimal degrees")
    lon: float = Field(..., description="Longitude in decimal degrees")
    name: Optional[str] = Field(
        default=None,
        description="Optional place name from the MERN client",
    )


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's natural-language message")
    location: Optional[Location] = Field(
        default=None,
        description="Optional device/user coordinates from the client",
    )
    role: Optional[str] = Field(
        default="citizen",
        description=(
            "UI persona: citizen, farmer, researcher, aviation, marine, "
            "climate_analyst, urban_planner, air_quality, flood_disaster"
        ),
    )
    alert_context: Optional[list[dict]] = Field(
        default=None,
        description="Optional official alerts from the MERN backend (IMD/CAP later)",
    )


class ChatResponse(BaseModel):
    response: str = Field(..., description="Assistant reply for the UI")
    language: SupportedLanguage = Field(
        ...,
        description=(
            "Detected reply language code "
            f"({', '.join(SUPPORTED_LANGUAGE_CODES)})"
        ),
    )
    status: Literal["ok"] = "ok"
    intent: Optional[str] = Field(
        default=None,
        description="Optional intent label for MERN chips/routing",
    )
    role: Optional[str] = Field(
        default=None,
        description="User role/persona from the MERN UI",
    )
    tool_calls: list[str] = Field(
        default_factory=list,
        description="Tools Gemini used for this answer",
    )
    risk: Optional[RiskScoreResponse] = None
    advisory: Optional[AdvisoryResponse] = None
    follow_up_questions: list[str] = Field(default_factory=list)
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Grounded response confidence (optional for MERN)",
    )
    latency_ms: Optional[int] = Field(
        default=None,
        description="End-to-end processing time in milliseconds",
    )
    tts_hint: Optional[str] = Field(
        default=None,
        description="Plain spoken text for later client-side TTS",
    )
    disaster_assessment: Optional[dict] = Field(
        default=None,
        description=(
            "Optional Flood & Disaster structured assessment for UI badges "
            "(hazard type, severity, models, agreement, official warning status)."
        ),
    )
    historical_analysis: Optional[dict] = Field(
        default=None,
        description="Optional ERA5 historical stats, comparison, charts, and NWP verification.",
    )
