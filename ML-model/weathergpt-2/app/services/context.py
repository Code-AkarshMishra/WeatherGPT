"""Resolve location and live weather for intelligence engines.

Never falls back to mock_baselines.json or other fabricated weather.
"""
from datetime import date
from typing import Any, Optional

from app.models.common import LocationQuery
from app.services.location import search_location
from app.services.weather import get_current_weather, get_forecast


def normalize_current_weather(raw: dict[str, Any]) -> dict[str, Any]:
    """Map Open-Meteo fields into the engine weather dict."""
    if not raw or raw.get("error"):
        return {}
    return {
        "temperature": raw.get("temperature", raw.get("temperature_c")),
        "feels_like": raw.get("feels_like", raw.get("feels_like_c")),
        "humidity": raw.get("humidity", raw.get("humidity_percent")),
        "rainfall_rate": raw.get("rainfall_rate", raw.get("rain_mm", raw.get("precipitation_mm"))),
        "rainfall_total": raw.get("rainfall_total", raw.get("precipitation_mm")),
        "precipitation_probability": raw.get("precipitation_probability"),
        "wind_speed": raw.get("wind_speed", raw.get("wind_speed_kmh")),
        "wind_gust": raw.get("wind_gust", raw.get("wind_speed_max_kmh")),
        "pressure": raw.get("pressure"),
        "visibility": raw.get("visibility"),
        "cloud_cover": raw.get("cloud_cover", raw.get("cloud_cover_percent")),
        "uv_index": raw.get("uv_index"),
        "condition": raw.get("condition"),
        "source": raw.get("source", "Open-Meteo"),
        "latitude": raw.get("latitude"),
        "longitude": raw.get("longitude"),
    }


def normalize_forecast(raw: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        days = raw
    else:
        days = (raw or {}).get("daily") or []
    normalized = []
    for day in days:
        normalized.append(
            {
                "date": day.get("date"),
                "temp_max": day.get("temp_max", day.get("temp_max_c")),
                "temp_min": day.get("temp_min", day.get("temp_min_c")),
                "rainfall_total": day.get("rainfall_total", day.get("precipitation_mm")),
                "precipitation_probability": day.get(
                    "precipitation_probability",
                    day.get("precipitation_probability_max"),
                ),
                "wind_speed": day.get("wind_speed", day.get("wind_speed_max_kmh")),
                "condition": day.get("condition"),
            }
        )
    return normalized


def geocode_if_needed(location: Optional[LocationQuery]) -> dict[str, Any]:
    """Return {name, lat, lon, source} using client coords or live geocoding only."""
    if location and location.lat is not None and location.lon is not None:
        return {
            "name": location.name or "Selected location",
            "lat": location.lat,
            "lon": location.lon,
            "source": "client_coordinates",
        }

    if location and location.name:
        found = search_location(location.name)
        if found and not found.get("error"):
            return {
                "name": found.get("name") or location.name,
                "lat": found.get("latitude"),
                "lon": found.get("longitude"),
                "source": "open_meteo_geocoding",
            }
        return {
            "name": location.name,
            "lat": None,
            "lon": None,
            "source": "geocode_unavailable",
            "error": (found or {}).get("error") or "Location not found. Do not guess coordinates.",
        }

    return {
        "name": None,
        "lat": None,
        "lon": None,
        "source": "missing",
        "error": "Location not provided.",
    }


def get_official_alerts(
    location_name: Optional[str] = None,
    alert_context: Optional[list[dict[str, Any]]] = None,
) -> tuple[list[dict[str, Any]], str]:
    """Official warnings come only from the backend/MERN caller — never from mock JSON."""
    if alert_context is not None:
        return list(alert_context), "backend_context"
    return [], "unavailable"


def build_weather_context(
    location: Optional[LocationQuery] = None,
    weather_override: Optional[dict[str, Any]] = None,
    forecast_override: Optional[list[dict[str, Any]]] = None,
    alert_override: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Assemble live Open-Meteo weather. Errors stay errors — no mock substitution."""
    needs_live_coords = weather_override is None or forecast_override is None
    if needs_live_coords:
        resolved = geocode_if_needed(location)
    else:
        resolved = {
            "name": location.name if location else "Unknown location",
            "lat": location.lat if location else None,
            "lon": location.lon if location else None,
            "source": "context_override",
        }
    notes: list[str] = []
    errors: list[str] = []

    if weather_override:
        weather = normalize_current_weather(weather_override)
        notes.append("weather: backend_context")
    elif resolved.get("lat") is not None and resolved.get("lon") is not None:
        live = get_current_weather(resolved["lat"], resolved["lon"])
        weather = normalize_current_weather(live)
        if live.get("error") or not weather:
            weather = {}
            notes.append("weather: unavailable")
            errors.append(live.get("error") or "Current weather unavailable.")
        else:
            notes.append("weather: open_meteo_live")
    else:
        weather = {}
        notes.append("weather: unavailable")
        errors.append(resolved.get("error") or "Coordinates required for live weather.")

    if forecast_override is not None:
        forecast = normalize_forecast(forecast_override)
        notes.append("forecast: backend_context")
    elif resolved.get("lat") is not None and resolved.get("lon") is not None:
        live_forecast = get_forecast(resolved["lat"], resolved["lon"], days=3)
        forecast = normalize_forecast(live_forecast)
        if live_forecast.get("error"):
            forecast = []
            notes.append("forecast: unavailable")
            errors.append(live_forecast.get("error") or "Forecast unavailable.")
        else:
            notes.append("forecast: open_meteo_live")
    else:
        forecast = []
        notes.append("forecast: unavailable")
        if "Coordinates required" not in " ".join(errors):
            errors.append(resolved.get("error") or "Coordinates required for live forecast.")

    alerts, alert_source = get_official_alerts(resolved.get("name"), alert_override)
    if alert_override is not None:
        notes.append("alerts: backend_context")
    else:
        notes.append("alerts: unavailable (no official feed configured in this request)")

    location_name = resolved.get("name") or "Unknown location"
    return {
        "location_name": location_name,
        "lat": resolved.get("lat"),
        "lon": resolved.get("lon"),
        "weather": weather,
        "forecast": forecast,
        "alerts": alerts,
        "alert_source": alert_source,
        "source_notes": "; ".join(notes),
        "errors": errors,
        "available": bool(weather or forecast or weather_override is not None),
        "month": date.today().month,
        "station": None,
    }
