"""Unit tests for deterministic RuleBasedRiskEngine."""
from app.ml.features import FeatureExtractor
from app.ml.risk_model import RuleBasedRiskEngine
from app.schemas.risk import HazardType, RiskLevel


def test_heavy_rain_risk_evaluation(sample_weather_payload, sample_alerts_payload):
    res = RuleBasedRiskEngine.evaluate(
        hazard=HazardType.HEAVY_RAIN,
        weather=sample_weather_payload,
        alerts=sample_alerts_payload,
    )

    assert res.score >= 60
    assert res.level in [RiskLevel.HIGH, RiskLevel.EXTREME]
    assert res.official_warning is True
    assert len(res.factors) > 0
    assert res.model_version == "rule-v1"


def test_heat_risk_evaluation():
    heat_weather = {
        "temperature": 43.5,
        "feels_like": 47.0,
        "humidity": 55,
        "rainfall_rate": 0.0,
        "uv_index": 10.0,
    }
    res = RuleBasedRiskEngine.evaluate(
        hazard=HazardType.HEAT,
        weather=heat_weather,
        alerts=[],
    )
    assert res.score >= 60
    assert res.level in [RiskLevel.HIGH, RiskLevel.EXTREME]
    assert any(f.feature == "feels_like" for f in res.factors)


def test_low_risk_clear_conditions():
    calm_weather = {
        "temperature": 24.0,
        "feels_like": 24.0,
        "humidity": 45,
        "rainfall_rate": 0.0,
        "wind_speed": 8.0,
        "visibility": 10.0,
    }
    res = RuleBasedRiskEngine.evaluate(
        hazard=HazardType.COMPOSITE,
        weather=calm_weather,
        alerts=[],
    )
    assert res.score < 30
    assert res.level == RiskLevel.LOW
