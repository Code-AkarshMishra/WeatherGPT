"""Chat and Backend integration schemas for WeatherGPT."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.advisory import AdvisoryResponse
from app.schemas.common import AlertItem, GeoLocation, LanguageCode, SourceMetadata
from app.schemas.risk import RiskScoreResponse


class CitationSource(BaseModel):
    title: str
    provider: str
    station_or_model: str
    timestamp: str
    data_points: List[str] = Field(default_factory=list)


class ConversationMessage(BaseModel):
    role: str = Field(description="'user', 'assistant', or 'system'")
    content: str


class BackendWeatherContext(BaseModel):
    current_weather: Optional[Dict[str, Any]] = None
    forecast: Optional[List[Dict[str, Any]]] = None
    alerts: Optional[List[Dict[str, Any]]] = None
    history: Optional[List[Dict[str, Any]]] = None


class ChatRequest(BaseModel):
    request_id: Optional[str] = Field(default=None, description="Unique trace ID passed from backend")
    message: Optional[str] = Field(default=None, description="User prompt text")
    user_message: Optional[str] = Field(default=None, description="Alias for user prompt")
    location: Optional[GeoLocation] = Field(default=None, description="Client or extracted location")
    language: str = Field(default="en", description="Target language ('en', 'hi', etc.)")
    conversation: List[ConversationMessage] = Field(default_factory=list, description="Recent conversation turns")
    context: Optional[BackendWeatherContext] = Field(default=None, description="Pre-fetched trusted backend context")
    weather_context: Optional[Dict[str, Any]] = Field(default=None, description="Alternative flat context key")
    forecast_context: Optional[List[Dict[str, Any]]] = Field(default=None, description="Alternative flat forecast key")
    alert_context: Optional[List[Dict[str, Any]]] = Field(default=None, description="Alternative flat alert key")
    history_context: Optional[List[Dict[str, Any]]] = Field(default=None, description="Alternative flat history key")
    user_preferences: Optional[Dict[str, Any]] = Field(default=None, description="User profile / domain preferences")

    def get_prompt(self) -> str:
        """Helper to get user message regardless of key used."""
        return (self.message or self.user_message or "").strip()


class ChatResponse(BaseModel):
    request_id: Optional[str] = None
    answer: str = Field(description="Grounded, natural language intelligence summary")
    intent: str = Field(description="Detected user intent category")
    language: str = Field(default="en", description="Output response language")
    sources: List[CitationSource] = Field(default_factory=list, description="Verified data source citations")
    data_timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    risk: Optional[RiskScoreResponse] = None
    advisory: Optional[AdvisoryResponse] = None
    follow_up_questions: List[str] = Field(default_factory=list)
    model_version: str = Field(default="weathergpt-v1.0")
    latency_ms: int = Field(default=0, description="Processing latency in milliseconds")
    tool_calls_executed: List[str] = Field(default_factory=list, description="Audit trail of executed data tools")
    weather_report: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Structured verified meteorological report from weather APIs (Open-Meteo)"
    )
    tts_hint: Optional[Dict[str, str]] = Field(
        default=None, 
        description="Optional voice synthesis hints (e.g. ssml, speech_rate)"
    )
