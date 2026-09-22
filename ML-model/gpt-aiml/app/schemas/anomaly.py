"""Anomaly detection schemas for comparing current/recent weather against historical baselines."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import GeoLocation


class AnomalyType(str, Enum):
    TEMPERATURE = "temperature"
    RAINFALL = "rainfall"
    HUMIDITY = "humidity"
    WIND = "wind"


class AnomalyMetricResult(BaseModel):
    metric: AnomalyType
    observed_value: float = Field(description="Current or target observed value")
    baseline_mean: float = Field(description="Climatological baseline mean value")
    baseline_std: float = Field(description="Climatological baseline standard deviation")
    expected_range_min: float = Field(description="Baseline normal lower bound (e.g. mean - 1.5*std)")
    expected_range_max: float = Field(description="Baseline normal upper bound (e.g. mean + 1.5*std)")
    departure_absolute: float = Field(description="observed - baseline_mean")
    departure_percent: Optional[float] = Field(default=None, description="Percentage departure from baseline")
    z_score: float = Field(description="Standardized Z-Score: (observed - mean) / std")
    percentile: float = Field(ge=0.0, le=100.0, description="Estimated climatological percentile")
    is_anomaly: bool = Field(description="True if |z_score| >= threshold (typically 2.0)")
    anomaly_direction: str = Field(description="'above_normal', 'below_normal', 'normal'")
    severity: str = Field(description="'NONE', 'SLIGHT', 'SIGNIFICANT', 'EXTREME'")
    baseline_period: str = Field(default="1991-2020 IMD Normals", description="Baseline normal reference epoch")
    units: str


class AnomalyDetectRequest(BaseModel):
    location: Optional[GeoLocation] = None
    metric: Optional[AnomalyType] = Field(default=None, description="Specific metric or all if None")
    observed_values: Optional[Dict[str, float]] = Field(default=None, description="Directly supplied test observations")
    month: Optional[int] = Field(default=None, ge=1, le=12, description="Target month for seasonal baseline")


class AnomalyDetectResponse(BaseModel):
    location_name: str
    month_analyzed: str
    baseline_period: str
    anomalies_detected: int
    results: List[AnomalyMetricResult]
    interpretation: str
    caveat: str = Field(
        default="Meteorological anomalies represent short-term departures from climatological averages and must not be conflated with long-term climate change trends without decadal attribution studies."
    )
    evaluated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
