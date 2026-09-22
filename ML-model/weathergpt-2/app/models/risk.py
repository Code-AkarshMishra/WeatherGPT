from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.common import LocationQuery


class HazardType(str, Enum):
    HEAT = "heat"
    HEAVY_RAIN = "heavy_rain"
    THUNDERSTORM = "thunderstorm"
    HIGH_WIND = "high_wind"
    FOG_VISIBILITY = "fog_visibility"
    COLD_WAVE = "cold_wave"
    COMPOSITE = "composite"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    EXTREME = "EXTREME"


class ContributingFactor(BaseModel):
    feature: str
    impact: str
    observed_value: Any
    threshold: Optional[str] = None
    contribution_points: Optional[float] = None


class RiskScoreRequest(BaseModel):
    location: Optional[LocationQuery] = None
    hazard: HazardType = HazardType.COMPOSITE
    weather_context: Optional[dict[str, Any]] = None
    forecast_context: Optional[list[dict[str, Any]]] = None
    alert_context: Optional[list[dict[str, Any]]] = None


class RiskScoreResponse(BaseModel):
    available: bool = True
    hazard: HazardType
    score: Optional[int] = Field(default=None, ge=0, le=100)
    level: Optional[RiskLevel] = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    model_version: str = "rule-v1"
    factors: list[ContributingFactor] = Field(default_factory=list)
    official_warning: bool = False
    official_warning_details: Optional[list[dict[str, Any]]] = None
    explanation: str
    evaluated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    source_notes: Optional[str] = None
    input_variables: Optional[dict[str, Any]] = Field(
        default=None,
        description="Raw meteorological inputs used in scoring (temperature, rain, wind, etc.)",
    )
    feature_weights: Optional[dict[str, float]] = Field(
        default=None,
        description="Hazard-specific weight matrix applied to normalized features",
    )
