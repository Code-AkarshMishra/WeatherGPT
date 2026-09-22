from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.common import LocationQuery


class HistoricalAnalysisRequest(BaseModel):
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    location: Optional[LocationQuery] = None
    locations: Optional[list[str]] = Field(
        default=None, description="Place names for multi-city comparison"
    )
    message: Optional[str] = Field(
        default=None,
        description="Natural-language period/question, e.g. last 5 years",
    )
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    include_verification: bool = False


class NwpVerificationRequest(BaseModel):
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    location: Optional[LocationQuery] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    message: Optional[str] = None
