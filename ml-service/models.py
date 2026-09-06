from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

class Location(BaseModel):
    lat: float = Field(..., description="Latitude in decimal degrees")
    lon: float = Field(..., description="Longitude in decimal degrees")

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's natural language weather or agriculture query")
    location: Optional[Location] = Field(default=None, description="Client coordinates (lat, lon)")
    role: Optional[str] = Field(default="citizen", description="Role: citizen, farmer, marine, disaster, aviation, researcher")

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI response text")
    language: Literal["en", "hi", "hinglish"] = Field(default="en", description="Detected language code")
    provider: str = Field(default="ml-unified-service", description="Model provider")
    status: Literal["ok", "error"] = "ok"
    disaster_risk: Optional[Dict[str, Any]] = None

class DisasterRiskRequest(BaseModel):
    rain_mm: float = Field(default=0.0, description="Rainfall in mm")
    wind_kmph: float = Field(default=0.0, description="Wind speed in km/h")
    temp_c: float = Field(default=25.0, description="Temperature in Celsius")
    city: Optional[str] = Field(default="Your Area", description="City / Region name")

class DisasterRiskResponse(BaseModel):
    city: str
    rain_mm: float
    wind_kmph: float
    temp_c: float
    imd_color_code: Literal["GREEN", "YELLOW", "ORANGE", "RED"]
    risk_assessment: str
    status_text: str
    status_text_hi: str
    farmer_advisory: Dict[str, str]
    marine_advisory: Dict[str, str]
    action_points: List[str]
    spoken_text_hi: str
    spoken_text_en: str
    audio_file: Optional[str] = None

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to synthesize to speech")
    language: Optional[str] = Field(default="hi", description="Language code (hi, en)")
    voice: Optional[str] = Field(default="hi-IN-SwaraNeural", description="Neural voice name")

class TTSResponse(BaseModel):
    status: str
    audio_file: Optional[str] = None
    message: str
