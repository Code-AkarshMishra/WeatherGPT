"""Steps 2–3: pick role variables, fetch Open-Meteo, normalize to a common bundle."""
from __future__ import annotations

from typing import Any, Optional

import httpx

from app.services.role_config import get_role_config
from app.services.weather import WEATHER_URL, _describe_weather_code

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

# Role variable flags → Open-Meteo field groups
_CURRENT_MAP = {
    "temperature": "temperature_2m",
    "feels_like": "apparent_temperature",
    "precipitation": "precipitation",
    "humidity": "relative_humidity_2m",
    "wind": "wind_speed_10m",
    "wind_gusts": "wind_gusts_10m",
    "wind_direction": "wind_direction_10m",
    "thunderstorm": "weather_code",
    "cloud_cover": "cloud_cover",
    "pressure": "pressure_msl",
}
_HOURLY_MAP = {
    "temperature": "temperature_2m",
    "precipitation": "precipitation",
    "precipitation_probability": "precipitation_probability",
    "thunderstorm": "weather_code",
    "humidity": "relative_humidity_2m",
    "dew_point": "dew_point_2m",
    "wind": "wind_speed_10m",
    "wind_gusts": "wind_gusts_10m",
    "wind_direction": "wind_direction_10m",
    "visibility": "visibility",
    "uv": "uv_index",
    "et0": "et0_fao_evapotranspiration",
    "soil_moisture": "soil_moisture_0_to_7cm",
    "soil_temperature": "soil_temperature_0cm",
    "cloud_cover": "cloud_cover",
    "pressure": "pressure_msl",
    "rainfall_intensity": "precipitation",
}
_DAILY_MAP = {
    "temperature": "temperature_2m_max,temperature_2m_min",
    "precipitation": "precipitation_sum",
    "precipitation_probability": "precipitation_probability_max",
    "wind": "wind_speed_10m_max",
    "wind_gusts": "wind_gusts_10m_max",
    "thunderstorm": "weather_code",
    "uv": "uv_index_max",
    "et0": "et0_fao_evapotranspiration",
    "rainfall_intensity": "precipitation_hours,precipitation_sum",
}


def required_variables(role: str, activity: Optional[str] = None) -> dict[str, bool]:
    cfg = get_role_config(role)
    flags = {name: True for name in cfg.get("variables") or []}
    if activity in {"pesticide_spraying", "fungicide_spraying"}:
        flags.update(
            {
                "precipitation": True,
                "precipitation_probability": True,
                "wind": True,
                "wind_gusts": True,
                "humidity": True,
                "temperature": True,
            }
        )
    if activity == "harvesting":
        flags.update(
            {
                "precipitation": True,
                "precipitation_probability": True,
                "wind": True,
                "wind_gusts": True,
                "thunderstorm": True,
            }
        )
    return flags


def _unique_fields(mapping: dict[str, str], flags: dict[str, bool]) -> list[str]:
    fields: list[str] = []
    seen: set[str] = set()
    for key, on in flags.items():
        if not on or key not in mapping:
            continue
        for field in mapping[key].split(","):
            field = field.strip()
            if field and field not in seen:
                seen.add(field)
                fields.append(field)
    if "weather_code" not in seen:
        fields.append("weather_code")
        seen.add("weather_code")
    return fields


def _idx(series: list[Any], i: int) -> Any:
    if i < len(series):
        return series[i]
    return None


def fetch_normalized_weather(
    latitude: float,
    longitude: float,
    days: int,
    flags: dict[str, bool],
    role: str,
    location_name: Optional[str] = None,
) -> dict[str, Any]:
    days = max(1, min(int(days), 7))
    current_fields = _unique_fields(_CURRENT_MAP, flags)
    hourly_fields = _unique_fields(_HOURLY_MAP, flags)
    daily_fields = _unique_fields(_DAILY_MAP, flags)

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": "auto",
        "forecast_days": days,
        "current": ",".join(current_fields),
        "hourly": ",".join(hourly_fields),
        "daily": ",".join(daily_fields),
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            response = client.get(WEATHER_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        return {
            "available": False,
            "error": "Weather service unavailable",
            "detail": str(exc),
            "location": {"name": location_name, "lat": latitude, "lon": longitude},
        }

    if isinstance(data, dict) and data.get("error"):
        return {
            "available": False,
            "error": data.get("reason") or "Weather API error",
            "location": {"name": location_name, "lat": latitude, "lon": longitude},
        }

    current_raw = data.get("current") or {}
    weather_code = current_raw.get("weather_code")
    current = {
        "temperature_c": current_raw.get("temperature_2m"),
        "feels_like_c": current_raw.get("apparent_temperature"),
        "humidity_percent": current_raw.get("relative_humidity_2m"),
        "precipitation_mm": current_raw.get("precipitation"),
        "wind_speed_kmh": current_raw.get("wind_speed_10m"),
        "wind_gust_kmh": current_raw.get("wind_gusts_10m"),
        "wind_direction_deg": current_raw.get("wind_direction_10m"),
        "pressure_hpa": current_raw.get("pressure_msl"),
        "visibility_m": current_raw.get("visibility"),
        "uv_index": current_raw.get("uv_index"),
        "cloud_cover_percent": current_raw.get("cloud_cover"),
        "weather_code": weather_code,
        "condition": _describe_weather_code(weather_code),
        "thunderstorm": bool(weather_code is not None and int(weather_code) >= 95),
    }

    daily_raw = data.get("daily") or {}
    daily: list[dict[str, Any]] = []
    for i, date in enumerate(daily_raw.get("time") or []):
        code = _idx(daily_raw.get("weather_code") or [], i)
        daily.append(
            {
                "date": date,
                "weather_code": code,
                "condition": _describe_weather_code(code),
                "temp_max_c": _idx(daily_raw.get("temperature_2m_max") or [], i),
                "temp_min_c": _idx(daily_raw.get("temperature_2m_min") or [], i),
                "precipitation_mm": _idx(daily_raw.get("precipitation_sum") or [], i),
                "precipitation_probability_max": _idx(
                    daily_raw.get("precipitation_probability_max") or [], i
                ),
                "precipitation_hours": _idx(daily_raw.get("precipitation_hours") or [], i),
                "wind_speed_max_kmh": _idx(daily_raw.get("wind_speed_10m_max") or [], i),
                "wind_gust_max_kmh": _idx(daily_raw.get("wind_gusts_10m_max") or [], i),
                "uv_index_max": _idx(daily_raw.get("uv_index_max") or [], i),
                "et0_mm": _idx(daily_raw.get("et0_fao_evapotranspiration") or [], i),
                "thunderstorm": bool(code is not None and int(code) >= 95),
            }
        )

    hourly_raw = data.get("hourly") or {}
    hourly: list[dict[str, Any]] = []
    cap = min(len(hourly_raw.get("time") or []), max(24, days * 24))
    for i, timestamp in enumerate((hourly_raw.get("time") or [])[:cap]):
        code = _idx(hourly_raw.get("weather_code") or [], i)
        hourly.append(
            {
                "time": timestamp,
                "temperature_c": _idx(hourly_raw.get("temperature_2m") or [], i),
                "precipitation_mm": _idx(hourly_raw.get("precipitation") or [], i),
                "precipitation_probability": _idx(
                    hourly_raw.get("precipitation_probability") or [], i
                ),
                "humidity_percent": _idx(hourly_raw.get("relative_humidity_2m") or [], i),
                "dew_point_c": _idx(hourly_raw.get("dew_point_2m") or [], i),
                "wind_speed_kmh": _idx(hourly_raw.get("wind_speed_10m") or [], i),
                "wind_gust_kmh": _idx(hourly_raw.get("wind_gusts_10m") or [], i),
                "wind_direction_deg": _idx(hourly_raw.get("wind_direction_10m") or [], i),
                "visibility_m": _idx(hourly_raw.get("visibility") or [], i),
                "uv_index": _idx(hourly_raw.get("uv_index") or [], i),
                "et0_mm": _idx(hourly_raw.get("et0_fao_evapotranspiration") or [], i),
                "soil_moisture": _idx(hourly_raw.get("soil_moisture_0_to_7cm") or [], i),
                "soil_temperature_c": _idx(hourly_raw.get("soil_temperature_0cm") or [], i),
                "cloud_cover_percent": _idx(hourly_raw.get("cloud_cover") or [], i),
                "pressure_hpa": _idx(hourly_raw.get("pressure_msl") or [], i),
                "weather_code": code,
                "condition": _describe_weather_code(code),
                "thunderstorm": bool(code is not None and int(code) >= 95),
            }
        )

    warnings: list[dict[str, Any]] = []
    for day in daily:
        if day.get("thunderstorm"):
            warnings.append({"type": "thunderstorm", "date": day.get("date"), "source": "open_meteo"})
        if (day.get("precipitation_mm") or 0) >= 50:
            warnings.append({"type": "heavy_rain", "date": day.get("date"), "source": "open_meteo"})

    extras: dict[str, Any] = {}
    if role == "marine":
        extras["marine"] = _fetch_marine(latitude, longitude, days)
    if role == "air_quality":
        extras["air_quality"] = _fetch_air_quality(latitude, longitude)

    return {
        "available": True,
        "source": "open_meteo",
        "location": {
            "name": location_name,
            "lat": data.get("latitude", latitude),
            "lon": data.get("longitude", longitude),
            "timezone": data.get("timezone"),
        },
        "forecast": {"hourly": hourly, "daily": daily},
        "current": current,
        "warnings": warnings,
        "extras": extras,
        "requested_variables": flags,
    }


def _fetch_marine(lat: float, lon: float, days: int) -> dict[str, Any]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "wave_height,wave_period,wave_direction",
        "forecast_days": max(1, min(days, 7)),
        "timezone": "auto",
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(MARINE_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        return {"available": False, "error": str(exc)}
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    rows = []
    for i, ts in enumerate(times[:48]):
        rows.append(
            {
                "time": ts,
                "wave_height_m": (hourly.get("wave_height") or [None])[i]
                if i < len(hourly.get("wave_height") or [])
                else None,
                "wave_period_s": (hourly.get("wave_period") or [None])[i]
                if i < len(hourly.get("wave_period") or [])
                else None,
                "wave_direction_deg": (hourly.get("wave_direction") or [None])[i]
                if i < len(hourly.get("wave_direction") or [])
                else None,
            }
        )
    return {"available": True, "hourly": rows}


def _fetch_air_quality(lat: float, lon: float) -> dict[str, Any]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide",
        "timezone": "auto",
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(AIR_QUALITY_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        return {"available": False, "error": str(exc)}
    current = payload.get("current") or {}
    if not current:
        return {"available": False, "error": "No air-quality measurements returned"}
    return {
        "available": True,
        "aqi": current.get("european_aqi"),
        "pm25": current.get("pm2_5"),
        "pm10": current.get("pm10"),
        "no2": current.get("nitrogen_dioxide"),
        "o3": current.get("ozone"),
        "so2": current.get("sulphur_dioxide"),
        "co": current.get("carbon_monoxide"),
        "source": "open_meteo_air_quality",
    }
