from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.common import LocationQuery
from app.models.risk import RiskLevel


class AdvisoryDomain(str, Enum):
    AGRICULTURE = "agriculture"
    TRAVEL = "travel"
    DISASTER = "disaster"
    URBAN_GENERAL = "urban_general"


class ActionRecommendation(BaseModel):
    action: str
    urgency: str
    priority: int = Field(default=1, ge=1, le=5)
    reason: str
    safety_warning: Optional[str] = None


class AdvisoryRequest(BaseModel):
    location: Optional[LocationQuery] = None
    domain: AdvisoryDomain = AdvisoryDomain.URBAN_GENERAL
    weather_context: Optional[dict[str, Any]] = None
    forecast_context: Optional[list[dict[str, Any]]] = None
    alert_context: Optional[list[dict[str, Any]]] = None


class AdvisoryResponse(BaseModel):
    domain: AdvisoryDomain
    severity: RiskLevel
    title: str
    summary: str
    recommendations: list[ActionRecommendation] = Field(default_factory=list)
    valid_from: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    valid_until: str
    caveats: str = (
        "Advisories are decision support from available weather data. "
        "They do not replace official emergency, agricultural, or transport mandates."
    )
    data_timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    source_notes: Optional[str] = None
