"""Unit tests for domain advisory service."""
from app.models.advisory import AdvisoryDomain, AdvisoryRequest
from app.models.risk import RiskLevel
from app.services.advisory import generate_advisory


def test_agriculture_advisory_rain_protection():
    res = generate_advisory(
        AdvisoryRequest(
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
    )
    assert res.domain == AdvisoryDomain.AGRICULTURE
    assert res.severity == RiskLevel.HIGH
    assert any("Postpone" in rec.action for rec in res.recommendations)


def test_travel_advisory_fog_visibility():
    res = generate_advisory(
        AdvisoryRequest(
            domain=AdvisoryDomain.TRAVEL,
            weather_context={
                "visibility": 1.2,
                "wind_speed": 5.0,
                "humidity": 95,
            },
            forecast_context=[],
            alert_context=[],
        )
    )
    assert res.domain == AdvisoryDomain.TRAVEL
    assert res.severity == RiskLevel.HIGH
    assert any(
        "fog lights" in rec.action.lower() or "visibility" in rec.reason.lower()
        for rec in res.recommendations
    )
