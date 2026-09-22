"""Unit tests for domain advisory service."""
import pytest
from app.schemas.advisory import AdvisoryDomain, AdvisoryRequest
from app.schemas.risk import RiskLevel
from app.services.advisory_service import AdvisoryService


@pytest.mark.asyncio
async def test_agriculture_advisory_rain_protection():
    service = AdvisoryService()
    req = AdvisoryRequest(
        domain=AdvisoryDomain.AGRICULTURE,
        weather_context={
            "rainfall_rate": 15.0,
            "precipitation_probability": 90,
            "wind_speed": 25.0,
            "temperature": 29.0,
        },
        forecast_context=[],
        alert_context=[],
    )

    res = await service.generate_advisory(req)
    assert res.domain == AdvisoryDomain.AGRICULTURE
    assert res.severity == RiskLevel.HIGH
    assert any("Postpone" in rec.action for rec in res.recommendations)


@pytest.mark.asyncio
async def test_travel_advisory_fog_visibility():
    service = AdvisoryService()
    req = AdvisoryRequest(
        domain=AdvisoryDomain.TRAVEL,
        weather_context={
            "visibility": 1.2,
            "wind_speed": 5.0,
            "humidity": 95,
        },
        forecast_context=[],
        alert_context=[],
    )

    res = await service.generate_advisory(req)
    assert res.domain == AdvisoryDomain.TRAVEL
    assert res.severity == RiskLevel.HIGH
    assert any("fog lights" in rec.action.lower() or "visibility" in rec.reason.lower() for rec in res.recommendations)
