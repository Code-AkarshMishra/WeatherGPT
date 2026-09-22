"""India Meteorological Department (IMD) city forecast client with Open-Meteo fallback."""
import os
from typing import Any, Optional

import httpx

from app.services.entities import imd_station_code

IMD_CITY_FORECAST_URL = "https://api.imd.gov.in/api/v1/cityforecast"
IMD_LEGACY_URL = "https://city.imd.gov.in/api/cityweather.php"


def _imd_headers() -> dict[str, str]:
    api_key = (os.getenv("IMD_API_KEY") or "").strip()
    if api_key:
        return {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    return {"Accept": "application/json"}


def fetch_imd_city_forecast(
    city_name: Optional[str] = None,
    station_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """
    Fetch official IMD 7-day city forecast when API key + network allow.
    Returns None if unavailable (IP not whitelisted, missing key, etc.).
    """
    sid = station_id or imd_station_code(city_name)
    if not sid:
        return None

    params = {"id": sid}
    urls = [
        (IMD_CITY_FORECAST_URL, params),
        (IMD_LEGACY_URL, params),
    ]

    for url, query in urls:
        try:
            with httpx.Client(timeout=12.0, follow_redirects=True) as client:
                response = client.get(url, params=query, headers=_imd_headers())
                if response.status_code != 200:
                    continue
                payload = response.json()
                if isinstance(payload, dict) and payload.get("error"):
                    continue
                return {
                    "source": "imd_official_city_forecast",
                    "provider": "India Meteorological Department (IMD)",
                    "station_id": sid,
                    "city_name": city_name,
                    "raw": payload,
                    "available": True,
                }
        except Exception:
            continue

    return {
        "source": "imd_unavailable",
        "provider": "IMD (not reachable — set IMD_API_KEY and whitelist server IP)",
        "station_id": sid,
        "city_name": city_name,
        "available": False,
        "note": (
            "IMD API requires registration, API key, and IP whitelisting. "
            "Using Open-Meteo NWP as fallback until IMD is configured."
        ),
    }


def parse_imd_daily_rows(imd_payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Best-effort parse of IMD JSON into daily rows for grounding."""
    raw = imd_payload.get("raw") if isinstance(imd_payload, dict) else imd_payload
    if not isinstance(raw, dict):
        return []

    rows: list[dict[str, Any]] = []
    # IMD responses vary; try common list keys
    candidates = raw.get("data") or raw.get("forecast") or raw.get("records")
    if isinstance(candidates, list):
        for item in candidates[:7]:
            if not isinstance(item, dict):
                continue
            rows.append(
                {
                    "date": item.get("Date") or item.get("date"),
                    "temp_max_c": item.get("Today_Max_temp")
                    or item.get("Day_1_Max_Temp")
                    or item.get("max_temp"),
                    "temp_min_c": item.get("Today_Min_temp")
                    or item.get("Day_1_Min_Temp")
                    or item.get("min_temp"),
                    "condition": item.get("Day_1_Forecast")
                    or item.get("Todays_Forecast")
                    or item.get("forecast"),
                    "rainfall_mm": item.get("Past_24_hrs_Rainfall")
                    or item.get("rainfall"),
                }
            )
    return rows
