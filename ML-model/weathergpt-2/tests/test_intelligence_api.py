"""FastAPI tests for intelligence endpoints (no Gemini key required)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_and_model_info():
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "healthy"
    assert "risk" in health.json()["engines"]

    info = client.get("/model-info")
    assert info.status_code == 200
    assert "risk_engine" in info.json()
    assert info.json()["mern_contract"]["required_chat_fields"] == [
        "response",
        "language",
        "status",
    ]


def test_risk_score_endpoint():
    res = client.post(
        "/risk/score",
        json={
            "hazard": "heavy_rain",
            "location": {"name": "Lucknow"},
            "weather_context": {
                "rainfall_rate": 18.0,
                "precipitation_probability": 90,
                "wind_gust": 42.0,
            },
            "forecast_context": [],
            "alert_context": [
                {
                    "hazard": "heavy_rain",
                    "severity": "ORANGE",
                    "headline": "Orange Alert: Heavy Rain",
                }
            ],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["hazard"] == "heavy_rain"
    assert data["score"] >= 60
    assert data["level"] in ["HIGH", "EXTREME"]


def test_advisory_endpoint():
    res = client.post(
        "/advisory",
        json={
            "domain": "agriculture",
            "location": {"name": "Lucknow"},
            "weather_context": {
                "rainfall_rate": 12.0,
                "precipitation_probability": 80,
                "temperature": 32.0,
            },
            "forecast_context": [],
            "alert_context": [],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["domain"] == "agriculture"
    assert len(data["recommendations"]) > 0


def test_anomaly_endpoint():
    res = client.post(
        "/anomaly/detect",
        json={
            "location": {"name": "Lucknow", "lat": 26.85, "lon": 80.95},
            "metric": "temperature",
            "observed_values": {"temperature": 36.5},
            "month": 9,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["anomalies_detected"] >= 1
    assert data["results"][0]["is_anomaly"] is True


def test_climate_endpoint():
    res = client.post(
        "/climate/analyze",
        json={
            "location": {"name": "Lucknow", "lat": 26.85, "lon": 80.95},
            "metric": "temperature",
            "period_years": 5,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["location_name"] == "Lucknow"
    assert data["available"] is True
    assert data["historical_mean"] is not None
    assert data["statistical_significance_p_value"] is None
    assert "not computed" in data["rate_of_change"].lower()
    assert "era5" in data["summary_narrative"].lower() or "era5" in (data.get("source_notes") or "").lower()


def test_chat_contract_still_requires_message():
    res = client.post("/chat", json={"message": ""})
    assert res.status_code == 422
