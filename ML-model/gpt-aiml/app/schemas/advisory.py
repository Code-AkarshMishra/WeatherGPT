"""Advisory schemas for domain-specific actionable weather intelligence."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import GeoLocation
from app.schemas.risk import RiskLevel


class AdvisoryDomain(str, Enum):
    AGRICULTURE = "agriculture"
    TRAVEL = "travel"
    DISASTER = "disaster"
    URBAN_GENERAL = "urban_general"


class ActionRecommendation(BaseModel):
    action: str = Field(description="Actionable guidance directive")
    urgency: str = Field(description="'immediate', 'moderate', 'planning'")
    priority: int = Field(default=1, ge=1, le=5, description="1 is highest priority")
    reason: str = Field(description="Scientific or meteorological rationale")
    safety_warning: Optional[str] = None


class AdvisoryRequest(BaseModel):
    location: Optional[GeoLocation] = None
    domain: AdvisoryDomain = Field(default=AdvisoryDomain.URBAN_GENERAL, description="Advisory category")
    weather_context: Optional[Dict[str, Any]] = None
    forecast_context: Optional[List[Dict[str, Any]]] = None
    alert_context: Optional[List[Dict[str, Any]]] = None
    user_context: Optional[Dict[str, Any]] = Field(
        default=None, 
        description="Domain context like crop_type, travel_route, outdoor_event_time"
    )


class AdvisoryResponse(BaseModel):
    domain: AdvisoryDomain
    severity: RiskLevel
    title: str = Field(description="Advisory title headline")
    summary: str = Field(description="Concise decision-support executive summary")
    recommendations: List[ActionRecommendation] = Field(default_factory=list)
    valid_from: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    valid_until: str
    caveats: str = Field(
        default="Advisories provide decision support based on available data and do not replace official emergency, agricultural, or transport authority mandates."
    )
    data_timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
