"""Build verified forecast summaries so the LLM cannot invent weekly trends."""
from statistics import mean
from typing import Any, Optional

from app.services.entities import extract_place_name, imd_station_code, parse_forecast_days
from app.services.imd_forecast import fetch_imd_city_forecast, parse_imd_daily_rows
from app.services.location import search_location
from app.services.weather import get_forecast


def resolve_coordinates(
    message: str,
    client_lat: Optional[float] = None,
    client_lon: Optional[float] = None,
    client_name: Optional[str] = None,
) -> dict[str, Any]:
    """
    Resolve lat/lon/name for a query.
    Priority: place in message → client GPS → client name → None.
    """
    place = extract_place_name(message)
    if place:
        found = search_location(place)
        if found and not found.get("error"):
            return {
                "name": found.get("name") or place,
                "lat": found.get("latitude"),
                "lon": found.get("longitude"),
                "source": "geocoded_from_message",
            }

    if client_lat is not None and client_lon is not None:
        return {
            "name": client_name or "Your location",
            "lat": client_lat,
            "lon": client_lon,
            "source": "client_gps",
        }

    if client_name:
        found = search_location(client_name)
        if found and not found.get("error"):
            return {
                "name": found.get("name") or client_name,
                "lat": found.get("latitude"),
                "lon": found.get("longitude"),
                "source": "geocoded_from_client_name",
            }

    return {"name": None, "lat": None, "lon": None, "source": "missing"}


def _trend_note(daily: list[dict[str, Any]]) -> str:
    if not daily:
        return "Insufficient daily data for trend."

    rain_days = 0
    max_temps: list[float] = []
    pops: list[float] = []
    for day in daily:
        pop = float(
            day.get("precipitation_probability_max")
            or day.get("precipitation_probability")
            or 0
        )
        precip = float(day.get("precipitation_mm") or day.get("rainfall_total") or 0)
        pops.append(pop)
        if pop >= 50 or precip >= 2.0:
            rain_days += 1
        tmax = day.get("temp_max_c") or day.get("temp_max")
        if tmax is not None:
            max_temps.append(float(tmax))

    avg_max = round(mean(max_temps), 1) if max_temps else None
    n = len(daily)
    mid = max(1, n // 2)
    early_pop = mean(pops[:mid]) if pops[:mid] else 0
    late_pop = mean(pops[mid:]) if pops[mid:] else 0
    rain_easing = early_pop - late_pop >= 12

    if avg_max and avg_max >= 33:
        temp_phrase = f"increasingly hot/humid with daytime highs around {avg_max}°C"
    elif avg_max and avg_max >= 28:
        temp_phrase = f"warm and humid with daytime highs around {avg_max}°C"
    elif avg_max:
        temp_phrase = f"daytime highs around {avg_max}°C"
    else:
        temp_phrase = "warm/humid conditions"

    if rain_easing and rain_days >= 2:
        rain_phrase = (
            "thunderstorm or rain chances higher in the first few days, "
            "then diminishing later in the week"
        )
    elif rain_days >= 5 and not rain_easing:
        rain_phrase = "frequent rain/thunderstorm spells through much of the week"
    elif rain_days >= 2:
        rain_phrase = "scattered rain/thunderstorm spells on several days"
    elif rain_days == 1:
        rain_phrase = "mostly dry with one rainier day"
    else:
        rain_phrase = "mostly dry conditions"

    return (
        f"Trend ({rain_days}/{n} days with meaningful rain chance): "
        f"{temp_phrase}; {rain_phrase}."
    )


def build_grounded_forecast(
    message: str,
    client_lat: Optional[float] = None,
    client_lon: Optional[float] = None,
    client_name: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Fetch Open-Meteo (+ IMD when available) and return a grounding package."""
    loc = resolve_coordinates(message, client_lat, client_lon, client_name)
    if loc.get("lat") is None or loc.get("lon") is None:
        return None

    days = parse_forecast_days(message, default=7)
    open_meteo = get_forecast(loc["lat"], loc["lon"], days=days)
    if open_meteo.get("error"):
        return {"error": open_meteo.get("error"), "location": loc}

    daily = open_meteo.get("daily") or []
    imd = fetch_imd_city_forecast(city_name=loc.get("name"), station_id=imd_station_code(loc.get("name")))
    imd_rows = parse_imd_daily_rows(imd) if imd and imd.get("available") else []

    lines = []
    for day in daily:
        lines.append(
            f"{day.get('date')}: max {day.get('temp_max_c')}°C / min {day.get('temp_min_c')}°C, "
            f"rain {day.get('precipitation_mm')} mm, rain chance {day.get('precipitation_probability_max')}%, "
            f"{day.get('condition')}"
        )

    primary_source = (
        "India Meteorological Department (IMD) + Open-Meteo NWP"
        if imd and imd.get("available")
        else "Open-Meteo global NWP (IMD not configured or unreachable — set IMD_API_KEY + IP whitelist)"
    )

    return {
        "location": loc,
        "forecast_days": days,
        "primary_source": primary_source,
        "daily_table": lines,
        "trend_note": _trend_note(daily),
        "open_meteo_daily": daily,
        "imd": imd,
        "imd_daily": imd_rows,
        "grounding_rules": (
            "Use ONLY the daily_table and trend_note above for multi-day forecast answers. "
            "Do NOT claim a rainy week if trend_note says rain eases. "
            "Do NOT invent official alerts for weekly forecast unless the user asked about warnings "
            "and alert_context was supplied by the backend."
        ),
    }
