"""
weather_service.py
Consolidated meteorological data service (ML-1).
Fetches real-time weather, historical archive data, and short-range forecast from Open-Meteo
with zero external API key requirements.
"""

from typing import Any, Dict, Optional
import httpx
import re
from datetime import datetime

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
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

def get_current_weather(lat: float, lon: float, location_name: Optional[str] = None) -> Dict[str, Any]:
    """Fetch current weather from Open-Meteo API."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,surface_pressure",
        "hourly": "precipitation_probability",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": "auto"
    }
    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.get(WEATHER_URL, params=params)
            res.raise_for_status()
            data = res.json()
            curr = data.get("current", {})
            hourly = data.get("hourly", {})
            daily = data.get("daily", {})
            
            rain_prob = 30
            if hourly.get("precipitation_probability"):
                rain_prob = int(hourly["precipitation_probability"][0])
            elif daily.get("precipitation_probability_max"):
                rain_prob = int(daily["precipitation_probability_max"][0])
            elif curr.get("precipitation", 0) > 0 or curr.get("rain", 0) > 0:
                rain_prob = 85

            return {
                "city": location_name or "Your Area",
                "latitude": lat,
                "longitude": lon,
                "temperature": round(curr.get("temperature_2m", 25.0), 1),
                "feels_like": round(curr.get("apparent_temperature", curr.get("temperature_2m", 25.0)), 1),
                "temp_max": round(daily.get("temperature_2m_max", [curr.get("temperature_2m", 25.0)])[0], 1) if daily.get("temperature_2m_max") else round(curr.get("temperature_2m", 25.0) + 2, 1),
                "temp_min": round(daily.get("temperature_2m_min", [curr.get("temperature_2m", 25.0)])[0], 1) if daily.get("temperature_2m_min") else round(curr.get("temperature_2m", 25.0) - 3, 1),
                "humidity": int(curr.get("relative_humidity_2m", 60)),
                "rain_mm": round(curr.get("rain", curr.get("precipitation", 0.0)), 1),
                "rain_probability": rain_prob,
                "wind_speed_kmh": round(curr.get("wind_speed_10m", 10.0), 1),
                "wind_direction": int(curr.get("wind_direction_10m", 0)),
                "pressure_hpa": round(curr.get("surface_pressure", 1012), 1),
                "weather_code": curr.get("weather_code", 0),
                "condition": describe_weather_code(curr.get("weather_code")),
            }
    except Exception as e:
        return {
            "city": location_name or "Your Area",
            "latitude": lat,
            "longitude": lon,
            "temperature": 25.0,
            "feels_like": 25.0,
            "humidity": 65,
            "rain_mm": 0.0,
            "rain_probability": 30,
            "wind_speed_kmh": 12.0,
            "condition": "Partly cloudy",
            "fallback": True,
            "error": str(e)
        }

def get_historical_weather(lat: float, lon: float, date_iso: str, location_name: str = "Location") -> Optional[Dict[str, Any]]:
    """
    Fetch exact historical archive weather from Open-Meteo Archive API.
    date_iso: YYYY-MM-DD
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": date_iso,
        "end_date": date_iso,
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max",
        "hourly": "temperature_2m,relative_humidity_2m,weather_code",
        "timezone": "auto"
    }
    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.get(ARCHIVE_URL, params=params)
            res.raise_for_status()
            data = res.json()
            daily = data.get("daily", {})
            hourly = data.get("hourly", {})

            if not daily or not daily.get("temperature_2m_max"):
                return None

            max_temp = daily["temperature_2m_max"][0]
            min_temp = daily["temperature_2m_min"][0]
            precip = daily.get("precipitation_sum", [0.0])[0]
            max_wind = daily.get("wind_speed_10m_max", [10.0])[0]
            code = daily.get("weather_code", [0])[0]
            
            # Average humidity from hourly
            h_hum = hourly.get("relative_humidity_2m", [])
            avg_hum = round(sum(h_hum) / len(h_hum)) if h_hum else 65

            return {
                "city": location_name,
                "date": date_iso,
                "max_temp": max_temp,
                "min_temp": min_temp,
                "avg_temp": round((max_temp + min_temp) / 2, 1),
                "precipitation_mm": precip,
                "max_wind_kmh": max_wind,
                "avg_humidity": avg_hum,
                "condition": describe_weather_code(code),
                "weather_code": code,
            }
    except Exception:
        return None

def search_location(query: str) -> Optional[Dict[str, Any]]:
    """Geocode city or place name via Open-Meteo Geocoding API."""
    cleaned = query.strip().rstrip("?,.!")
    if not cleaned:
        return None
    try:
        with httpx.Client(timeout=6.0) as client:
            res = client.get(GEOCODING_URL, params={"name": cleaned, "count": 1, "language": "en", "format": "json"})
            res.raise_for_status()
            results = res.json().get("results", [])
            if results:
                top = results[0]
                city_name = top.get("name")
                admin1 = top.get("admin1")
                country = top.get("country", "")
                full_name = f"{city_name}, {admin1}" if admin1 and admin1 != city_name else (f"{city_name}, {country}" if country else city_name)
                return {
                    "name": city_name,
                    "full_name": full_name,
                    "latitude": top.get("latitude"),
                    "longitude": top.get("longitude"),
                    "country": country
                }
    except Exception:
        pass
    return None

