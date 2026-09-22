"""Pytest configuration and fixtures for WeatherGPT tests."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.core.config import get_settings
from app.main import app


@pytest.fixture
def sample_weather_payload():
    return {
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
        "cloud_cover": 85,
        "uv_index": 6.0,
        "condition": "Heavy Rain and Thunderstorm",
        "source": "IMD_Lucknow_Station_42182",
    }


@pytest.fixture
def sample_alerts_payload():
    return [
        {
            "alert_id": "IMD-UP-2026-TEST",
            "hazard": "heavy_rain",
            "severity": "ORANGE",
            "headline": "Orange Alert: Heavy to Very Heavy Rain Spells",
            "description": "Continuous rain spells expected across district.",
            "instruction": "Avoid low-lying inundated paths.",
            "issued_by": "IMD",
            "valid_from": "2026-09-11T08:00:00Z",
            "valid_until": "2026-09-12T08:00:00Z",
        }
    ]


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
