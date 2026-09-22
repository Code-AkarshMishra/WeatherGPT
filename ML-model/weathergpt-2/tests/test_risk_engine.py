"""Unit tests for deterministic RuleBasedRiskEngine."""
from app.ml.risk_model import RuleBasedRiskEngine
from app.models.risk import HazardType, RiskLevel


def test_heavy_rain_risk_evaluation():
    weather = {
        "temperature": 34.5,
        "feels_like": 39.0,
        "humidity": 78,
        "rainfall_rate": 12.0,
        "rainfall_total": 25.0,
        "precipitation_probability": 85,
        "wind_speed": 22.0,
        "wind_gust": 38.0,
        "pressure": 1002.0,
        "visibility": 4.5,
        "condition": "Heavy Rain and Thunderstorm",
    }
    alerts = [
        {
            "hazard": "heavy_rain",
            "severity": "ORANGE",
            "headline": "Orange Alert: Heavy Rain",
        }
    ]
    res = RuleBasedRiskEngine.evaluate(
        hazard=HazardType.HEAVY_RAIN,
        weather=weather,
        alerts=alerts,
    )
    assert res.score >= 60
    assert res.level in [RiskLevel.HIGH, RiskLevel.EXTREME]
    assert res.official_warning is True
    assert res.model_version == "rule-v1"


def test_heat_risk_evaluation():
    res = RuleBasedRiskEngine.evaluate(
        hazard=HazardType.HEAT,
        weather={
            "temperature": 43.5,
            "feels_like": 47.0,
            "humidity": 55,
            "rainfall_rate": 0.0,
            "uv_index": 10.0,
        },
        alerts=[],
    )
    assert res.score >= 60
    assert any(item.feature == "feels_like" for item in res.factors)


def test_low_risk_clear_conditions():
    res = RuleBasedRiskEngine.evaluate(
        hazard=HazardType.COMPOSITE,
        weather={
            "temperature": 24.0,
            "feels_like": 24.0,
            "humidity": 45,
            "rainfall_rate": 0.0,
            "wind_speed": 8.0,
            "visibility": 10.0,
        },
        alerts=[],
    )
    assert res.score < 30
    assert res.level == RiskLevel.LOW


def test_open_meteo_field_aliases_work():
    res = RuleBasedRiskEngine.evaluate(
        hazard=HazardType.HEAT,
        weather={
            "temperature_c": 43.5,
            "feels_like_c": 47.0,
            "humidity_percent": 55,
            "wind_speed_kmh": 8.0,
        },
        alerts=[],
    )
    assert res.score >= 60
