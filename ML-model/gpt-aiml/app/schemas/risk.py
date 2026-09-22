"""Risk engine schemas for multi-hazard meteorological risk evaluation."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import AlertItem, GeoLocation, WeatherConditionSummary


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
    feature: str = Field(description="Name of the meteorological feature (e.g. rainfall_rate, feels_like)")
    impact: str = Field(description="Impact degree: 'low', 'moderate', 'high', 'critical'")
    observed_value: Any = Field(description="Observed numerical value or state")
    threshold: Optional[str] = Field(default=None, description="Active threshold benchmark")
    contribution_points: Optional[float] = Field(default=None, description="Score points contributed")


class RiskScoreRequest(BaseModel):
    location: Optional[GeoLocation] = None
    hazard: HazardType = Field(default=HazardType.COMPOSITE, description="Target hazard or composite risk")
    weather_context: Optional[Dict[str, Any]] = Field(default=None, description="Current conditions payload")
    forecast_context: Optional[List[Dict[str, Any]]] = Field(default=None, description="Upcoming forecast timeline")
    alert_context: Optional[List[Dict[str, Any]]] = Field(default=None, description="Active official alerts")


class RiskScoreResponse(BaseModel):
    hazard: HazardType
    score: int = Field(ge=0, le=100, description="Normalized risk index from 0 to 100")
    level: RiskLevel
    confidence: float = Field(ge=0.0, le=1.0, description="Model/rule confidence level")
    model_version: str = Field(default="rule-v1", description="Model identifier used for inference")
    factors: List[ContributingFactor] = Field(default_factory=list, description="Ranked contributing meteorological factors")
    official_warning: bool = Field(default=False, description="Whether an active official IMD warning matches this hazard")
    official_warning_details: Optional[List[Dict[str, Any]]] = None
    explanation: str = Field(description="Interpretable narrative explaining the calculated risk")
    evaluated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
