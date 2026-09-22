from typing import Any, Optional

import httpx

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"


def search_location(location_name: str) -> Optional[dict[str, Any]]:
    """
    Convert a place name into structured location data.
    Returns None if no match is found.
    """
    location_name = location_name.strip()
    if not location_name:
        return None

    params = {
        "name": location_name,
        "count": 1,
        "language": "en",
        "format": "json",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(GEOCODING_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        return {"error": "Location service unavailable", "detail": str(exc)}

    if isinstance(data, dict) and data.get("error"):
        return data

    results = data.get("results") or []
    if not results:
        return None

    place = results[0]
    return {
        "name": place.get("name"),
        "latitude": place.get("latitude"),
        "longitude": place.get("longitude"),
        "country": place.get("country"),
        "admin1": place.get("admin1"),
        "timezone": place.get("timezone"),
    }
