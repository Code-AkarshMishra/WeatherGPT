from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.common import LocationQuery


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
    location: Optional[LocationQuery] = None
    metric: ClimateMetric = ClimateMetric.TEMPERATURE
    period_years: int = Field(default=30, ge=5, le=100)


class ClimateTrendResponse(BaseModel):
    available: bool = True
    location_name: str
    metric: ClimateMetric
    period: str
    trend_direction: TrendDirection
    rate_of_change: str
    statistical_significance_p_value: Optional[float] = None
    historical_mean: Optional[float] = None
    historical_min: Optional[float] = None
    historical_max: Optional[float] = None
    annual_summary: dict[str, Any] = Field(default_factory=dict)
    summary_narrative: str
    methodology: str = (
        "Statistics from Open-Meteo Historical Weather API (ERA5 reanalysis) when available. "
        "Multi-decadal climate-change trends and p-values are not invented."
    )
    limitations: str = (
        "ERA5 reanalysis is not station observations. Windows are capped; "
        "short records must not be treated as climate-change attribution."
    )
    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    source_notes: Optional[str] = None
