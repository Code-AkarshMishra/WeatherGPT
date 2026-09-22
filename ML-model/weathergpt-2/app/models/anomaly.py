from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.models.common import LocationQuery


class AnomalyType(str, Enum):
    TEMPERATURE = "temperature"
    RAINFALL = "rainfall"
    HUMIDITY = "humidity"
    WIND = "wind"


class AnomalyMetricResult(BaseModel):
    metric: AnomalyType
    observed_value: float
    baseline_mean: float
    baseline_std: float
    expected_range_min: float
    expected_range_max: float
    departure_absolute: float
    departure_percent: Optional[float] = None
    z_score: float
    percentile: float = Field(ge=0.0, le=100.0)
    is_anomaly: bool
    anomaly_direction: str
    severity: str
    baseline_period: str = "ERA5 same-month reanalysis"
    units: str


class AnomalyDetectRequest(BaseModel):
    location: Optional[LocationQuery] = None
    metric: Optional[AnomalyType] = None
    observed_values: Optional[dict[str, float]] = None
    month: Optional[int] = Field(default=None, ge=1, le=12)


class AnomalyDetectResponse(BaseModel):
    location_name: str
    month_analyzed: str
    baseline_period: str
    anomalies_detected: int
    results: list[AnomalyMetricResult]
    interpretation: str
    caveat: str = (
        "Short-term departures from climatological averages must not be treated "
        "as climate-change attribution without a longer study."
    )
    evaluated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    source_notes: Optional[str] = None
