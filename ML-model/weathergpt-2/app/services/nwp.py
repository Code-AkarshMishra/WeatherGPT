"""Fetch and normalize GFS / ECMWF hourly NWP from Open-Meteo."""
from __future__ import annotations

import time
from typing import Any, Optional

import httpx

from app.core.nwp_config import (
    ECMWF_HOURLY,
    ECMWF_URL,
    GFS_HOURLY_CORE,
    GFS_HOURLY_OPTIONAL,
    GFS_URL,
    NWP_CACHE_TTL_SECONDS,
    NWP_FORECAST_HOURS,
    NWP_HTTP_TIMEOUT,
)


class _TtlCache:
    def __init__(self, ttl_seconds: int) -> None:
        self.ttl = ttl_seconds
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any:
        item = self._store.get(key)
        if item is None:
            return None
        value, ts = item
        if time.time() - ts > self.ttl:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (value, time.time())


_CACHE = _TtlCache(NWP_CACHE_TTL_SECONDS)


def _cache_key(model: str, lat: float, lon: float, hours: int) -> str:
    return f"{model}:{round(lat, 3)}:{round(lon, 3)}:{hours}"


def _num(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _idx(series: Optional[list[Any]], i: int) -> Any:
    if not series or i >= len(series):
        return None
    return series[i]


def parse_nwp_hourly(payload: dict[str, Any], model: str) -> dict[str, Any]:
    """Normalize an Open-Meteo GFS/ECMWF JSON payload into hourly rows."""
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    rows: list[dict[str, Any]] = []
    for i, ts in enumerate(times):
        rows.append(
            {
                "time": ts,
                "precipitation_mm": _num(_idx(hourly.get("precipitation"), i)),
                "rain_mm": _num(_idx(hourly.get("rain"), i)),
                "precipitation_probability": _num(
                    _idx(hourly.get("precipitation_probability"), i)
                ),
                "wind_speed_kmh": _num(_idx(hourly.get("wind_speed_10m"), i)),
                "wind_gust_kmh": _num(_idx(hourly.get("wind_gusts_10m"), i)),
                "wind_direction_deg": _num(_idx(hourly.get("wind_direction_10m"), i)),
                "temperature_c": _num(_idx(hourly.get("temperature_2m"), i)),
                "humidity_percent": _num(_idx(hourly.get("relative_humidity_2m"), i)),
                "pressure_hpa": _num(_idx(hourly.get("pressure_msl"), i)),
                "cloud_cover_percent": _num(_idx(hourly.get("cloud_cover"), i)),
                "cape_jkg": _num(_idx(hourly.get("cape"), i)),
                "thunderstorm_probability": _num(
                    _idx(hourly.get("thunderstorm_probability"), i)
                ),
            }
        )
    return {
        "model": model,
        "available": True,
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "timezone": payload.get("timezone"),
        "hourly": rows,
        "hourly_count": len(rows),
    }


def _fetch_endpoint(
    url: str,
    latitude: float,
    longitude: float,
    hours: int,
    hourly_fields: list[str],
) -> dict[str, Any]:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "forecast_hours": hours,
        "timezone": "auto",
        "hourly": ",".join(hourly_fields),
    }
    with httpx.Client(timeout=NWP_HTTP_TIMEOUT) as client:
        response = client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
    if isinstance(data, dict) and data.get("error"):
        raise httpx.HTTPError(str(data.get("reason") or data.get("error")))
    return data


def get_gfs_forecast(
    latitude: float,
    longitude: float,
    hours: int = NWP_FORECAST_HOURS,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Fetch ~48h GFS hourly NWP. Optional thunderstorm_probability dropped on 400."""
    key = _cache_key("gfs", latitude, longitude, hours)
    if use_cache:
        cached = _CACHE.get(key)
        if cached is not None:
            return cached
    fields = GFS_HOURLY_CORE + GFS_HOURLY_OPTIONAL
    try:
        try:
            payload = _fetch_endpoint(GFS_URL, latitude, longitude, hours, fields)
        except httpx.HTTPStatusError:
            payload = _fetch_endpoint(GFS_URL, latitude, longitude, hours, GFS_HOURLY_CORE)
        result = parse_nwp_hourly(payload, "gfs")
        result["source"] = "open_meteo_gfs"
        result["endpoint"] = GFS_URL
    except httpx.HTTPError as exc:
        result = {
            "model": "gfs",
            "available": False,
            "error": "GFS NWP unavailable",
            "detail": str(exc),
            "hourly": [],
        }
    if use_cache and result.get("available"):
        _CACHE.set(key, result)
    return result


def get_ecmwf_forecast(
    latitude: float,
    longitude: float,
    hours: int = NWP_FORECAST_HOURS,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Fetch ~48h ECMWF IFS hourly NWP."""
    key = _cache_key("ecmwf", latitude, longitude, hours)
    if use_cache:
        cached = _CACHE.get(key)
        if cached is not None:
            return cached
    try:
        payload = _fetch_endpoint(ECMWF_URL, latitude, longitude, hours, ECMWF_HOURLY)
        result = parse_nwp_hourly(payload, "ecmwf")
        result["source"] = "open_meteo_ecmwf_ifs"
        result["endpoint"] = ECMWF_URL
        result["notes"] = [
            "ECMWF IFS via Open-Meteo does not provide 2 m humidity or precipitation probability.",
            "ECMWF weather codes do not estimate thunderstorms.",
        ]
    except httpx.HTTPError as exc:
        result = {
            "model": "ecmwf",
            "available": False,
            "error": "ECMWF NWP unavailable",
            "detail": str(exc),
            "hourly": [],
        }
    if use_cache and result.get("available"):
        _CACHE.set(key, result)
    return result


def get_nwp_forecasts(
    latitude: float,
    longitude: float,
    hours: int = NWP_FORECAST_HOURS,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Fetch GFS + ECMWF. Missing models are marked unavailable — never fabricated."""
    gfs = get_gfs_forecast(latitude, longitude, hours=hours, use_cache=use_cache)
    ecmwf = get_ecmwf_forecast(latitude, longitude, hours=hours, use_cache=use_cache)
    available = []
    if gfs.get("available"):
        available.append("GFS")
    if ecmwf.get("available"):
        available.append("ECMWF")
    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "forecast_hours": hours,
        "models": {"gfs": gfs, "ecmwf": ecmwf},
        "available_models": available,
        "both_unavailable": not available,
    }
