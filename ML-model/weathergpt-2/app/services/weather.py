from typing import Any, Optional

import httpx

from app.core.nwp_config import ARCHIVE_HTTP_TIMEOUT, ARCHIVE_URL, HISTORICAL_CACHE_TTL_SECONDS
from app.services.nwp import _TtlCache

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

# Open-Meteo weather codes → short human-readable labels
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
    96: "Thunderstorm (possible light hail)",
    99: "Thunderstorm (possible heavy hail)",
}


def _describe_weather_code(code: int | None) -> str:
    if code is None:
        return "Unknown"
    return WEATHER_CODE_MAP.get(code, f"Unknown weather code ({code})")


def get_current_weather(latitude: float, longitude: float) -> dict[str, Any]:
    """
    Fetch current weather for the given coordinates from Open-Meteo.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": ",".join(
            [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "rain",
                "weather_code",
                "cloud_cover",
                "wind_speed_10m",
                "wind_direction_10m",
            ]
        ),
        "timezone": "auto",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(WEATHER_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        return {"error": "Weather service unavailable", "detail": str(exc)}

    if isinstance(data, dict) and data.get("error"):
        return data

    current = data.get("current") or {}
    units = data.get("current_units") or {}
    weather_code = current.get("weather_code")

    return {
        "latitude": data.get("latitude", latitude),
        "longitude": data.get("longitude", longitude),
        "timezone": data.get("timezone"),
        "temperature_c": current.get("temperature_2m"),
        "feels_like_c": current.get("apparent_temperature"),
        "humidity_percent": current.get("relative_humidity_2m"),
        "precipitation_mm": current.get("precipitation"),
        "rain_mm": current.get("rain"),
        "weather_code": weather_code,
        "condition": _describe_weather_code(weather_code),
        "cloud_cover_percent": current.get("cloud_cover"),
        "wind_speed_kmh": current.get("wind_speed_10m"),
        "wind_direction_deg": current.get("wind_direction_10m"),
        "units": {
            "temperature": units.get("temperature_2m", "°C"),
            "precipitation": units.get("precipitation", "mm"),
            "wind_speed": units.get("wind_speed_10m", "km/h"),
        },
    }


def get_forecast(
    latitude: float,
    longitude: float,
    days: int = 3,
) -> dict[str, Any]:
    """
    Fetch a short-range forecast for the given coordinates.
    `days` is clamped between 1 and 7 for the MVP.
    """
    days = max(1, min(int(days), 7))

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": ",".join(
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
            ]
        ),
        "hourly": ",".join(
            [
                "temperature_2m",
                "precipitation_probability",
                "precipitation",
                "weather_code",
            ]
        ),
        "forecast_days": days,
        "timezone": "auto",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(WEATHER_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        return {"error": "Weather service unavailable", "detail": str(exc)}

    if isinstance(data, dict) and data.get("error"):
        return data

    daily = data.get("daily") or {}
    hourly = data.get("hourly") or {}

    daily_forecast = []
    dates = daily.get("time") or []
    for i, date in enumerate(dates):
        code = (daily.get("weather_code") or [None])[i]
        daily_forecast.append(
            {
                "date": date,
                "weather_code": code,
                "condition": _describe_weather_code(code),
                "temp_max_c": (daily.get("temperature_2m_max") or [None])[i],
                "temp_min_c": (daily.get("temperature_2m_min") or [None])[i],
                "precipitation_mm": (daily.get("precipitation_sum") or [None])[i],
                "precipitation_probability_max": (
                    daily.get("precipitation_probability_max") or [None]
                )[i],
                "wind_speed_max_kmh": (daily.get("wind_speed_10m_max") or [None])[i],
            }
        )

    # Keep a compact hourly sample (first 24 hours) so responses stay readable.
    hourly_forecast = []
    hourly_times = hourly.get("time") or []
    for i, timestamp in enumerate(hourly_times[:24]):
        code = (hourly.get("weather_code") or [None])[i]
        hourly_forecast.append(
            {
                "time": timestamp,
                "temperature_c": (hourly.get("temperature_2m") or [None])[i],
                "precipitation_mm": (hourly.get("precipitation") or [None])[i],
                "precipitation_probability": (
                    hourly.get("precipitation_probability") or [None]
                )[i],
                "weather_code": code,
                "condition": _describe_weather_code(code),
            }
        )

    return {
        "latitude": data.get("latitude", latitude),
        "longitude": data.get("longitude", longitude),
        "timezone": data.get("timezone"),
        "forecast_days": days,
        "daily": daily_forecast,
        "hourly_next_24h": hourly_forecast,
    }


ARCHIVE_URL = ARCHIVE_URL  # re-export for existing imports
_HIST_CACHE = _TtlCache(HISTORICAL_CACHE_TTL_SECONDS)

ARCHIVE_DAILY_FIELDS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "precipitation_sum",
    "wind_speed_10m_max",
    "weather_code",
]


def _idx(series: Optional[list[Any]], i: int) -> Any:
    if not series or i >= len(series):
        return None
    return series[i]


def parse_archive_daily(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize Open-Meteo archive daily arrays into row dicts. No fabrication."""
    daily = payload.get("daily") or {}
    times = daily.get("time") or []
    rows: list[dict[str, Any]] = []
    for i, day in enumerate(times):
        code = _idx(daily.get("weather_code"), i)
        precip = _idx(daily.get("precipitation_sum"), i)
        rows.append(
            {
                "date": day,
                "temp_max_c": _idx(daily.get("temperature_2m_max"), i),
                "temp_min_c": _idx(daily.get("temperature_2m_min"), i),
                "mean_temp_c": _idx(daily.get("temperature_2m_mean"), i),
                "precipitation_mm": precip,
                "wind_speed_max_kmh": _idx(daily.get("wind_speed_10m_max"), i),
                "weather_code": code,
                "condition": _describe_weather_code(code if isinstance(code, int) else None),
            }
        )
    return rows


def fetch_historical_daily(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Fetch ERA5/reanalysis daily rows from Open-Meteo Historical Weather API.

    Does not invent missing days. Incomplete ranges are flagged.
    """
    key = f"archive:{round(latitude, 3)}:{round(longitude, 3)}:{start_date}:{end_date}"
    if use_cache:
        cached = _HIST_CACHE.get(key)
        if cached is not None:
            return cached
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": ",".join(ARCHIVE_DAILY_FIELDS),
        "timezone": "auto",
    }
    try:
        with httpx.Client(timeout=ARCHIVE_HTTP_TIMEOUT) as client:
            response = client.get(ARCHIVE_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        return {
            "available": False,
            "error": "Historical weather service unavailable",
            "detail": str(exc),
            "daily": [],
            "source": "open_meteo_historical_archive",
        }
    if isinstance(data, dict) and data.get("error"):
        return {
            "available": False,
            "error": str(data.get("reason") or data.get("error")),
            "daily": [],
            "source": "open_meteo_historical_archive",
        }
    rows = parse_archive_daily(data)
    result = {
        "available": True,
        "latitude": data.get("latitude", latitude),
        "longitude": data.get("longitude", longitude),
        "timezone": data.get("timezone"),
        "start_date": start_date,
        "end_date": end_date,
        "daily": rows,
        "day_count": len(rows),
        "source": "open_meteo_historical_archive",
        "dataset": "ERA5 / Open-Meteo Historical Weather API (reanalysis, not station observations)",
    }
    if use_cache:
        _HIST_CACHE.set(key, result)
    return result


def get_historical_weather(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str | None = None,
) -> dict[str, Any]:
    """Fetch past weather from the Open-Meteo reanalysis archive.

    Single-day callers still receive the first-day fields. Date ranges also
    include a `daily` list — previously only the first day was returned.
    """
    end = end_date or start_date
    bundle = fetch_historical_daily(latitude, longitude, start_date, end)
    if not bundle.get("available"):
        return bundle
    first = (bundle.get("daily") or [{}])[0]
    return {
        "latitude": bundle.get("latitude", latitude),
        "longitude": bundle.get("longitude", longitude),
        "date": start_date,
        "start_date": start_date,
        "end_date": end,
        "mean_temp_c": first.get("mean_temp_c"),
        "temp_max_c": first.get("temp_max_c"),
        "temp_min_c": first.get("temp_min_c"),
        "precipitation_mm": first.get("precipitation_mm"),
        "wind_speed_max_kmh": first.get("wind_speed_max_kmh"),
        "weather_code": first.get("weather_code"),
        "condition": first.get("condition"),
        "daily": bundle.get("daily") or [],
        "day_count": bundle.get("day_count") or 0,
        "source": "open_meteo_historical_archive",
        "dataset": bundle.get("dataset"),
    }
