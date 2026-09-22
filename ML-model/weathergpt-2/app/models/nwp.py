from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.models.common import LocationQuery


class NwpHazardRequest(BaseModel):
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    location: Optional[LocationQuery] = None
    role: Optional[str] = Field(
        default="citizen",
        description="Persona for advisory text (citizen, farmer, disaster, aviation, ...)",
    )
    hours: int = Field(default=48, ge=24, le=48)


class NwpHazardResponse(BaseModel):
    available: bool
    assessment_name: str = "NWP Hazard Assessment"
    official_warning: bool = False
    location: dict[str, Any]
    forecast_window: Optional[dict[str, Any]] = None
    models: Optional[dict[str, Any]] = None
    hazards: list[dict[str, Any]] = Field(default_factory=list)
    overall_risk: Optional[Literal["normal", "watch", "elevated", "high"]] = None
    model_agreement: Optional[str] = None
    advisory: Optional[str] = None
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    disclaimer: Optional[str] = None
    available_models: list[str] = Field(default_factory=list)
    model_stats: Optional[dict[str, Any]] = None
    disaster_assessment: Optional[dict[str, Any]] = None
    error: Optional[str] = None
