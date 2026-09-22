"""Climate analysis schemas for long-term historical trend and statistical intelligence."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import GeoLocation


class ClimateMetric(str, Enum):
    TEMPERATURE = "temperature"
    RAINFALL = "rainfall"
    MONSOON_ONSET = "monsoon_onset"
    EXTREME_EVENTS = "extreme_events"


class TrendDirection(str, Enum):
    INCREASING = "increasing"
    DECREASING = "decreasing"
    STABLE = "stable"
    VARIABLE = "variable"


class ClimateTrendRequest(BaseModel):
    location: Optional[GeoLocation] = None
    metric: ClimateMetric = Field(default=ClimateMetric.TEMPERATURE)
    period_years: int = Field(default=30, ge=5, le=100, description="Analysis window in years")


class ClimateTrendResponse(BaseModel):
    location_name: str
    metric: ClimateMetric
    period: str
    trend_direction: TrendDirection
    rate_of_change: str = Field(description="e.g. '+0.28°C per decade' or unavailable")
    statistical_significance_p_value: Optional[float] = None
    historical_mean: Optional[float] = None
    historical_min: Optional[float] = None
    historical_max: Optional[float] = None
    annual_summary: Dict[str, Any] = Field(default_factory=dict)
    summary_narrative: str
    methodology: str = Field(
        default="Live archive statistics when available. Hardcoded climate normals are not used."
    )
    limitations: str = Field(
        default="Without a live multi-year archive analysis, climate statistics are reported as unavailable."
    )
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    source_notes: Optional[str] = None
