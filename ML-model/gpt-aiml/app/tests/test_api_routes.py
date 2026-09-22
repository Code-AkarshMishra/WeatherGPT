"""Integration tests for all FastAPI REST endpoints."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "gemini_key_slots" in data


@pytest.mark.asyncio
async def test_model_info_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/model-info")
        assert res.status_code == 200
        data = res.json()
        assert "risk_engine" in data
        assert "anomaly_engine" in data


@pytest.mark.asyncio
async def test_chat_api_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "message": "Will it rain tomorrow in Lucknow and should I carry an umbrella?",
            "location": {"name": "Lucknow", "lat": 26.85, "lon": 80.95},
            "language": "en"
        }
        res = await client.post("/api/v1/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "answer" in data
        assert len(data["sources"]) > 0
        assert "confidence" in data


@pytest.mark.asyncio
async def test_risk_score_api_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "hazard": "heavy_rain",
            "location": {"name": "Lucknow"},
            "weather_context": {
                "rainfall_rate": 18.0,
                "precipitation_probability": 90,
                "wind_gust": 42.0,
            }
        }
        res = await client.post("/api/v1/risk/score", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["hazard"] == "heavy_rain"
        assert data["score"] >= 60
        assert data["level"] in ["HIGH", "EXTREME"]
        assert len(data["factors"]) > 0


@pytest.mark.asyncio
async def test_advisory_api_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "domain": "agriculture",
            "location": {"name": "Lucknow"},
            "weather_context": {
                "rainfall_rate": 12.0,
                "precipitation_probability": 80,
                "temperature": 32.0,
            }
        }
        res = await client.post("/api/v1/advisory", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["domain"] == "agriculture"
        assert len(data["recommendations"]) > 0


@pytest.mark.asyncio
async def test_climate_analyze_api_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "metric": "temperature",
            "location": {"name": "Lucknow"},
            "period_years": 30
        }
        res = await client.post("/api/v1/climate/analyze", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["metric"] == "temperature"
        assert "rate_of_change" in data


@pytest.mark.asyncio
async def test_anomaly_detect_api_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "location": {"name": "Lucknow"},
            "metric": "temperature",
            "observed_values": {"temperature": 37.0},
            "month": 9
        }
        res = await client.post("/api/v1/anomaly/detect", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "results" in data
        assert len(data["results"]) == 1
