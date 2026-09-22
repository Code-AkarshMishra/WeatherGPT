"""Unit tests for Pydantic request and response schemas."""
import pytest
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.common import GeoLocation
from app.schemas.risk import HazardType, RiskLevel, RiskScoreRequest, RiskScoreResponse


def test_geo_location_defaults():
    loc = GeoLocation(name="Lucknow", lat=26.85, lon=80.95)
    assert loc.name == "Lucknow"
    assert loc.country == "India"
    assert loc.lat == 26.85


def test_chat_request_helper():
    req1 = ChatRequest(message="Will it rain tomorrow?")
    assert req1.get_prompt() == "Will it rain tomorrow?"

    req2 = ChatRequest(user_message="Are there any alerts in Mumbai?")
    assert req2.get_prompt() == "Are there any alerts in Mumbai?"


def test_risk_score_response_schema():
    resp = RiskScoreResponse(
        hazard=HazardType.HEAVY_RAIN,
        score=78,
        level=RiskLevel.HIGH,
        confidence=0.88,
        explanation="High rainfall rate and active warning.",
    )
    assert resp.score == 78
    assert resp.level == RiskLevel.HIGH
    assert resp.model_version == "rule-v1"
