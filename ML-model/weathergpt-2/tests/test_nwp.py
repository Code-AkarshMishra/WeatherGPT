"""Unit tests for GFS/ECMWF NWP parsing and rules-based hazard detection."""
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.services.nwp import parse_nwp_hourly
from app.services.nwp_hazards import (
    aggregate_model_window,
    analyze_nwp_hazards,
    build_role_advisory,
    classify_rain_severity,
    classify_wind_severity,
    format_nwp_context_block,
    model_agreement,
)
from app.services.intent import classify_intent

client = TestClient(app)


def _payload(model: str, precip: list[float], wind: list[float], gust: list[float], cape: list[float] | None = None):
    n = len(precip)
    times = [f"2026-09-16T{i:02d}:00" for i in range(n)]
    hourly = {
        "time": times,
        "precipitation": precip,
        "rain": precip,
        "wind_speed_10m": wind,
        "wind_gusts_10m": gust,
        "wind_direction_10m": [90] * n,
        "temperature_2m": [30] * n,
        "pressure_msl": [1008] * n,
        "cloud_cover": [70] * n,
        "cape": cape or [200] * n,
    }
    if model == "gfs":
        hourly["precipitation_probability"] = [80] * n
        hourly["relative_humidity_2m"] = [75] * n
    return {
        "latitude": 26.85,
        "longitude": 80.95,
        "timezone": "Asia/Kolkata",
        "hourly": hourly,
    }


def _rows_from_precip(values: list[float]) -> list[dict]:
    parsed = parse_nwp_hourly(_payload("gfs", values, [10] * len(values), [12] * len(values)), "gfs")
    return parsed["hourly"]


def test_parse_gfs_hourly():
    precip = [1.0] * 48
    parsed = parse_nwp_hourly(_payload("gfs", precip, [20] * 48, [30] * 48, [1500] * 48), "gfs")
    assert parsed["available"] is True
    assert parsed["hourly_count"] == 48
    assert parsed["hourly"][0]["precipitation_mm"] == 1.0
    assert parsed["hourly"][0]["precipitation_probability"] == 80


def test_parse_ecmwf_hourly():
    precip = [2.0] * 24
    parsed = parse_nwp_hourly(_payload("ecmwf", precip, [15] * 24, [22] * 24), "ecmwf")
    assert parsed["hourly"][0]["precipitation_probability"] is None  # not in ECMWF
    assert parsed["hourly"][3]["rain_mm"] == 2.0


def test_rainfall_24h_aggregation():
    precip = [5.0] * 24 + [0.0] * 24
    stats24 = aggregate_model_window(_rows_from_precip(precip), 24)
    assert stats24["precip_24h_mm"] == 120.0
    assert stats24["max_hourly_precip_mm"] == 5.0


def test_rainfall_48h_aggregation():
    precip = [2.0] * 48
    stats48 = aggregate_model_window(_rows_from_precip(precip), 48)
    assert stats48["precip_48h_mm"] == 96.0
    assert stats48["precip_6h_max_mm"] == 12.0
    assert stats48["precip_12h_max_mm"] == 24.0


def test_strong_wind_detection():
    assert classify_wind_severity({"max_wind_kmh": 20, "max_gust_kmh": 25}) == "none"
    assert classify_wind_severity({"max_wind_kmh": 42, "max_gust_kmh": 50}) == "moderate"
    assert classify_wind_severity({"max_wind_kmh": 30, "max_gust_kmh": 92}) == "high"


def test_rain_severity_classification():
    assert classify_rain_severity({"precip_24h_mm": 10, "max_hourly_precip_mm": 1, "precip_6h_max_mm": 3, "precip_12h_max_mm": 6}) == "none"
    assert classify_rain_severity({"precip_24h_mm": 40, "max_hourly_precip_mm": 4, "precip_6h_max_mm": 10, "precip_12h_max_mm": 20}) == "watch"
    assert classify_rain_severity({"precip_24h_mm": 70, "max_hourly_precip_mm": 8, "precip_6h_max_mm": 20, "precip_12h_max_mm": 40}) == "moderate"
    assert classify_rain_severity({"precip_24h_mm": 120, "max_hourly_precip_mm": 10, "precip_6h_max_mm": 30, "precip_12h_max_mm": 50}) == "high"


def test_model_agreement():
    assert model_agreement(110, 96) == "high"
    assert model_agreement(110, 70) == "moderate"
    assert model_agreement(110, 20) == "low"
    assert model_agreement(110, None) == "single_model"
    assert model_agreement(None, None) == "unavailable"


def test_missing_model_data():
    gfs_hourly = parse_nwp_hourly(_payload("gfs", [5.0] * 24, [10] * 24, [12] * 24), "gfs")["hourly"]
    bundle = {
        "forecast_hours": 48,
        "available_models": ["GFS"],
        "models": {
            "gfs": {"available": True, "hourly": gfs_hourly},
            "ecmwf": {"available": False, "hourly": []},
        },
    }
    assessment = analyze_nwp_hazards(bundle)
    assert "GFS" in assessment["available_models"]
    rain = next((h for h in assessment["hazards"] if h["type"] == "heavy_rain"), None)
    if rain:
        assert rain["model_agreement"] == "single_model"
        assert rain["ecmwf_value"] is None


def test_both_models_heavy_rain_agreement():
    gfs = parse_nwp_hourly(_payload("gfs", [4.6] * 24, [12] * 24, [18] * 24), "gfs")["hourly"]
    ecm = parse_nwp_hourly(_payload("ecmwf", [4.0] * 24, [11] * 24, [16] * 24), "ecmwf")["hourly"]
    assessment = analyze_nwp_hazards(
        {
            "forecast_hours": 48,
            "available_models": ["GFS", "ECMWF"],
            "models": {
                "gfs": {"available": True, "hourly": gfs},
                "ecmwf": {"available": True, "hourly": ecm},
            },
        }
    )
    rain = next(h for h in assessment["hazards"] if h["type"] == "heavy_rain")
    assert rain["severity"] in {"moderate", "high"}
    assert rain["model_agreement"] == "high"
    assert assessment["official_warning"] is False
    assert assessment["overall_risk"] in {"elevated", "high"}


def test_api_invalid_coordinates():
    res = client.post("/nwp/hazard-assessment", json={"latitude": 999, "longitude": 80.9})
    assert res.status_code == 422


def test_api_timeout_both_models():
    def _timeout(*_a, **_k):
        raise httpx.TimeoutException("timed out")

    with patch("app.services.nwp._fetch_endpoint", side_effect=_timeout):
        from app.services.nwp import get_nwp_forecasts

        bundle = get_nwp_forecasts(26.85, 80.95, use_cache=False)
        assert bundle["both_unavailable"] is True
        assert bundle["models"]["gfs"]["available"] is False
        assert bundle["models"]["ecmwf"]["available"] is False


def test_llm_block_uses_only_structured_numbers():
    assessment = {
        "assessment_name": "NWP Hazard Assessment",
        "official_warning": False,
        "overall_risk": "high",
        "model_agreement": "high",
        "available_models": ["GFS", "ECMWF"],
        "forecast_window": {"start": "t0", "end_24h": "t1"},
        "hazards": [
            {
                "type": "heavy_rain",
                "severity": "high",
                "gfs_value": 110,
                "ecmwf_value": 96,
                "model_agreement": "high",
            }
        ],
        "model_stats": {},
        "disclaimer": "not official",
        "advisory": "Both models indicate heavy rainfall.",
    }
    block = format_nwp_context_block(assessment, "Lucknow")
    assert "110" in block and "96" in block
    assert "official_warning" in block
    assert "Do NOT invent" in block
    # Guardrail: no extra invented millimetres besides the structured ones
    assert "999 mm" not in block


def test_role_advisory_disaster_does_not_order_evacuation():
    text = build_role_advisory(
        {
            "overall_risk": "high",
            "model_agreement": "high",
            "hazards": [{"type": "heavy_rain", "severity": "high"}],
        },
        role="disaster",
    )
    assert "not a flood prediction" in text.lower() or "not an official" in text.lower()
    assert "evacuat" not in text.lower()


def test_nwp_intent():
    assert classify_intent("Show GFS and ECMWF hazard agreement for Lucknow") == "nwp_hazard"


def test_health_lists_nwp_engine():
    health = client.get("/health")
    assert "nwp_hazard" in health.json()["engines"]
    info = client.get("/model-info")
    assert "nwp_hazard_engine" in info.json()
