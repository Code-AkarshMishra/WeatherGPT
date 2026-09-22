"""Common schemas and value objects for WeatherGPT."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LanguageCode(str, Enum):
    EN = "en"
    HI = "hi"
    TA = "ta"
    TE = "te"
    BN = "bn"
    MR = "mr"


class GeoLocation(BaseModel):
    name: Optional[str] = Field(default=None, description="City or station name")
    state: Optional[str] = Field(default=None, description="State / Province")
    country: Optional[str] = Field(default="India", description="Country name")
    lat: Optional[float] = Field(default=None, description="Latitude in decimal degrees")
    lon: Optional[float] = Field(default=None, description="Longitude in decimal degrees")


class SourceMetadata(BaseModel):
    provider: str = Field(description="Data provider/station name (e.g. IMD, ECMWF, Open-Meteo)")
    retrieved_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    station_id: Optional[str] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    data_quality: str = Field(default="verified", description="'verified', 'interpolated', or 'fallback'")


class WeatherConditionSummary(BaseModel):
    temperature: Optional[float] = Field(default=None, description="Temperature in Celsius")
    feels_like: Optional[float] = Field(default=None, description="Feels like temperature in Celsius")
    humidity: Optional[int] = Field(default=None, ge=0, le=100, description="Relative humidity percentage")
    rainfall_rate: Optional[float] = Field(default=None, ge=0.0, description="Current precipitation rate mm/hr")
    rainfall_total: Optional[float] = Field(default=None, ge=0.0, description="Accumulated rainfall mm")
    precipitation_probability: Optional[int] = Field(default=None, ge=0, le=100, description="PoP %")
    wind_speed: Optional[float] = Field(default=None, ge=0.0, description="Wind speed in km/h")
    wind_gust: Optional[float] = Field(default=None, ge=0.0, description="Wind gust in km/h")
    pressure: Optional[float] = Field(default=None, description="Atmospheric pressure in hPa")
    visibility: Optional[float] = Field(default=None, ge=0.0, description="Visibility in km")
    cloud_cover: Optional[int] = Field(default=None, ge=0, le=100, description="Cloud cover %")
    uv_index: Optional[float] = Field(default=None, ge=0.0, description="UV Index")
    condition: Optional[str] = Field(default=None, description="Text condition summary from live observations")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    source: Optional[str] = Field(default=None, description="Observation source identifier")


class AlertItem(BaseModel):
    alert_id: str
    hazard: str = Field(description="'heavy_rain', 'heat', 'thunderstorm', 'cyclone', 'flood', etc.")
    severity: str = Field(description="'RED', 'ORANGE', 'YELLOW', 'GREEN'")
    headline: str
    description: str
    instruction: Optional[str] = None
    issued_by: str = "India Meteorological Department (IMD)"
    valid_from: str
    valid_until: str
