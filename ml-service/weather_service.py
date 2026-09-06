"""
weather_service.py
Consolidated meteorological data service (ML-1).
Fetches real-time weather and short-range forecast from Open-Meteo
with zero external API key requirements.
"""

from typing import Any, Dict, Optional
import httpx

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

WEATHER_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with light hail",
    99: "Thunderstorm with heavy hail",
}

def describe_weather_code(code: Optional[int]) -> str:
    if code is None:
        return "Unknown"
    return WEATHER_CODE_MAP.get(code, f"Weather condition ({code})")

def get_current_weather(lat: float, lon: float) -> Dict[str, Any]:
    """Fetch current weather from Open-Meteo API."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m",
        "timezone": "auto"
    }
    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.get(WEATHER_URL, params=params)
            res.raise_for_status()
            data = res.json()
            curr = data.get("current", {})
            return {
                "latitude": lat,
                "longitude": lon,
                "temperature": curr.get("temperature_2m", 25.0),
                "feels_like": curr.get("apparent_temperature", 25.0),
                "humidity": curr.get("relative_humidity_2m", 60),
                "rain_mm": curr.get("rain", 0.0),
                "wind_speed_kmh": curr.get("wind_speed_10m", 10.0),
                "weather_code": curr.get("weather_code", 0),
                "condition": describe_weather_code(curr.get("weather_code")),
            }
    except Exception as e:
        return {
            "latitude": lat,
            "longitude": lon,
            "temperature": 25.0,
            "feels_like": 25.0,
            "humidity": 65,
            "rain_mm": 0.0,
            "wind_speed_kmh": 12.0,
            "condition": "Partly cloudy",
            "fallback": True,
            "error": str(e)
        }

def search_location(query: str) -> Optional[Dict[str, Any]]:
    """Geocode city or place name via Open-Meteo Geocoding API."""
    try:
        with httpx.Client(timeout=6.0) as client:
            res = client.get(GEOCODING_URL, params={"name": query, "count": 1, "language": "en", "format": "json"})
            res.raise_for_status()
            results = res.json().get("results", [])
            if results:
                top = results[0]
                return {
                    "name": top.get("name"),
                    "latitude": top.get("latitude"),
                    "longitude": top.get("longitude"),
                    "country": top.get("country", "")
                }
    except Exception:
        pass
    return None
