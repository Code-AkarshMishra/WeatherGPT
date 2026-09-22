from typing import Optional

from pydantic import BaseModel, Field


class LocationQuery(BaseModel):
    """Flexible location for intelligence APIs. MERN can send name and/or coordinates."""

    name: Optional[str] = Field(default=None, description="City or place name")
    lat: Optional[float] = Field(default=None, description="Latitude in decimal degrees")
    lon: Optional[float] = Field(default=None, description="Longitude in decimal degrees")
    state: Optional[str] = None
    country: Optional[str] = Field(default="India")
