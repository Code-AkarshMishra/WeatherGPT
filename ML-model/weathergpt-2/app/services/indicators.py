"""Step 4 — role-specific derived indicators from normalized weather.

Missing live fields stay unavailable — never invent temperature/humidity/visibility.
"""
from __future__ import annotations

from typing import Any, Optional

from app.services.role_config import get_role_config


def _level(value: float, low: float, high: float, invert: bool = False) -> str:
    if invert:
        if value >= high:
            return "low"
        if value >= low:
            return "moderate"
        return "high"
    if value >= high:
        return "high"
    if value >= low:
        return "moderate"
    return "low"


def _num(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _first(*values: Any) -> Optional[float]:
    for value in values:
        parsed = _num(value)
        if parsed is not None:
            return parsed
    return None


def _window_day(bundle: dict[str, Any], time_range: str) -> dict[str, Any]:
    daily = (bundle.get("forecast") or {}).get("daily") or []
    if not daily:
        return {}
    if time_range in {"tomorrow"} and len(daily) > 1:
        return daily[1]
    return daily[0]


def _find_spray_window(hourly: list[dict[str, Any]]) -> Optional[str]:
    good: list[str] = []
    for row in hourly[:24]:
        wind = _num(row.get("wind_speed_kmh"))
        gust = _num(row.get("wind_gust_kmh"))
        if gust is None:
            gust = wind
        pop = _num(row.get("precipitation_probability"))
        rain = _num(row.get("precipitation_mm"))
        if (
            wind is not None
            and gust is not None
            and pop is not None
            and rain is not None
            and wind <= 15
            and gust <= 25
            and pop < 40
            and rain < 0.2
            and not row.get("thunderstorm")
        ):
            ts = str(row.get("time") or "")
            if "T" in ts:
                good.append(ts.split("T")[1][:5])
    if not good:
        return None
    return f"{good[0]}–{good[-1]}"


def _risk_from(value: Optional[float], low: float, high: float, invert: bool = False) -> str:
    if value is None:
        return "unknown"
    return _level(value, low, high, invert=invert)


def compute_indicators(
    role: str,
    bundle: dict[str, Any],
    parsed: dict[str, Any],
) -> dict[str, Any]:
    cfg = get_role_config(role)
    wanted = set(cfg.get("indicators") or [])
    current = bundle.get("current") or {}
    day = _window_day(bundle, parsed.get("time_range") or "today")
    hourly = (bundle.get("forecast") or {}).get("hourly") or []

    pop = _first(day.get("precipitation_probability_max"), current.get("precipitation_probability"))
    rain = _first(day.get("precipitation_mm"), current.get("precipitation_mm"))
    wind = _first(day.get("wind_speed_max_kmh"), current.get("wind_speed_kmh"))
    gust = _first(day.get("wind_gust_max_kmh"), current.get("wind_gust_kmh"), wind)
    tmax = _first(day.get("temp_max_c"), current.get("temperature_c"))
    tmin = _first(day.get("temp_min_c"), tmax)
    humidity = _num(current.get("humidity_percent"))
    vis_m = current.get("visibility_m")
    vis_km = (_num(vis_m) / 1000.0) if vis_m is not None and _num(vis_m) is not None else None
    storm = bool(day.get("thunderstorm") or current.get("thunderstorm"))
    rain_hours = _num(day.get("precipitation_hours"))
    et0 = _num(day.get("et0_mm"))

    rain_risk_input = None
    if pop is not None or rain is not None:
        rain_risk_input = max(pop or 0.0, (rain or 0.0) * 8)

    outdoor_input = None
    if pop is not None or storm or tmax is not None:
        outdoor_input = max(
            pop or 0.0,
            80 if storm else 0,
            ((tmax - 30) * 10) if tmax is not None else 0,
        )

    travel_input = None
    if pop is not None or gust is not None or storm:
        travel_input = max(pop or 0.0, gust or 0.0, 90 if storm else 0)

    harvest_input = None
    if pop is not None or rain is not None or gust is not None:
        harvest_input = max(pop or 0.0, (rain or 0.0) * 10, gust or 0.0)

    lodging_input = None
    if gust is not None or rain is not None or storm:
        lodging_input = (gust or 0.0) + (8 if storm else 0) + ((rain or 0.0) * 2)

    shatter_input = None
    if gust is not None or rain is not None:
        shatter_input = (gust or 0.0) + (rain or 0.0) * 3

    waterlog_input = None
    if rain is not None or rain_hours is not None:
        waterlog_input = (rain or 0.0) + (rain_hours or 0.0) * 2

    spray_input = None
    if wind is not None or gust is not None or pop is not None or rain is not None:
        spray_input = max(wind or 0.0, gust or 0.0, pop or 0.0, (rain or 0.0) * 20)

    irrigation_input = None
    if et0 is not None or rain is not None:
        irrigation_input = (et0 or 0.0) + max(0.0, 8 - (rain or 0.0))

    fungal_input = None
    if humidity is not None or rain is not None:
        fungal_input = (humidity or 0.0) + (rain or 0.0) * 2

    field_input = None
    if rain is not None or pop is not None or gust is not None:
        field_input = max((rain or 0.0) * 8, pop or 0.0, gust or 0.0)

    drying_input = None
    if humidity is not None or pop is not None or rain is not None:
        drying_input = max(humidity or 0.0, pop or 0.0, (rain or 0.0) * 10)

    flight_input = None
    if storm or gust is not None or vis_km is not None or pop is not None:
        flight_input = max(
            90 if storm else 0,
            gust or 0.0,
            (5 - vis_km) * 20 if vis_km is not None else 0,
            (pop or 0.0) * 0.6,
        )

    urban_input = None
    if rain is not None or rain_hours is not None:
        urban_input = (rain or 0.0) + (rain_hours or 0.0) * 3

    stormwater_input = urban_input
    drainage_input = rain

    infra_input = None
    if rain is not None or tmax is not None or storm:
        infra_input = max((rain or 0.0) * 2, tmax or 0.0, 80 if storm else 0)

    wind_gust_input = None
    if wind is not None or gust is not None:
        wind_gust_input = max(wind or 0.0, gust or 0.0)

    marine_input = None
    if wind is not None or gust is not None or storm:
        marine_input = max(wind or 0.0, gust or 0.0, 90 if storm else 0)

    boat_input = None
    if wind is not None or gust is not None or storm:
        boat_input = max(wind or 0.0, gust or 0.0, 100 if storm else 0)

    all_indicators: dict[str, Any] = {
        "rain_risk": _risk_from(rain_risk_input, 40, 70),
        "heat_risk": _risk_from(tmax, 34, 38),
        "heat_stress": _risk_from(tmax, 34, 38),
        "storm_risk": (
            "high" if storm else ("moderate" if pop is not None and pop >= 60 else ("low" if pop is not None else "unknown"))
        ),
        "thunderstorm_risk": "high" if storm else "low",
        "wind_risk": _risk_from(wind_gust_input, 25, 40),
        "outdoor_activity_risk": _risk_from(outdoor_input, 40, 70),
        "travel_disruption_risk": _risk_from(travel_input, 45, 70),
        "harvest_risk": _risk_from(harvest_input, 45, 70),
        "lodging_risk": _risk_from(lodging_input, 28, 40),
        "shattering_risk": _risk_from(shatter_input, 30, 42),
        "waterlogging_risk": _risk_from(waterlog_input, 15, 40),
        "spraying_suitability": _risk_from(spray_input, 15, 35, invert=True),
        "irrigation_need": _risk_from(irrigation_input, 4, 7),
        "fungal_disease_weather_risk": _risk_from(fungal_input, 75, 90),
        "frost_risk": (
            "unknown"
            if tmin is None
            else ("high" if tmin <= 2 else ("moderate" if tmin <= 6 else "low"))
        ),
        "field_work_suitability": _risk_from(field_input, 40, 70, invert=True),
        "post_harvest_drying_risk": _risk_from(drying_input, 70, 85),
        "visibility_risk": _risk_from(vis_km, 2.0, 5.0, invert=True),
        "ceiling_risk": (
            "unknown"
            if _num(current.get("cloud_cover_percent")) is None
            else ("moderate" if _num(current.get("cloud_cover_percent")) >= 80 else "low")
        ),
        "flight_weather_risk": _risk_from(flight_input, 35, 60),
        "strong_wind_risk": _risk_from(wind_gust_input, 25, 40),
        "marine_weather_risk": _risk_from(marine_input, 25, 40),
        "small_boat_risk": _risk_from(boat_input, 20, 32),
        "rough_sea_risk": "unknown",
        "urban_flood_risk": _risk_from(urban_input, 20, 45),
        "stormwater_pressure": _risk_from(stormwater_input, 15, 40),
        "drainage_stress": _risk_from(drainage_input, 20, 40),
        "heat_island_risk": _risk_from(tmax, 35, 39),
        "infrastructure_weather_risk": _risk_from(infra_input, 30, 50),
        "stagnation_risk": (
            "unknown"
            if wind is None or rain is None
            else ("high" if wind < 8 and rain < 1 else ("moderate" if wind < 12 else "low"))
        ),
        "rain_washout_effect": (
            "unknown"
            if rain is None
            else ("likely" if rain >= 5 else ("possible" if rain >= 1 else "unlikely"))
        ),
        "pollution_risk": "unknown",
        "particulate_matter_risk": "unknown",
        "dispersion_conditions": (
            "unknown"
            if wind is None
            else ("poor" if wind < 8 else ("moderate" if wind < 15 else "good"))
        ),
        "ozone_risk": "unknown",
        "data_completeness": "high" if day and hourly else ("medium" if day or hourly else "low"),
        "climate_trend_signal": "see_climatology_block",
    }

    marine = (bundle.get("extras") or {}).get("marine") or {}
    if marine.get("available") and marine.get("hourly"):
        heights = [h for h in (_num(r.get("wave_height_m")) for r in marine["hourly"][:24]) if h is not None]
        max_wave = max(heights) if heights else None
        all_indicators["rough_sea_risk"] = _risk_from(max_wave, 1.2, 2.5)
        if max_wave is not None and wind_gust_input is not None:
            all_indicators["small_boat_risk"] = _risk_from(max(max_wave * 15, wind_gust_input), 20, 32)

    aq = (bundle.get("extras") or {}).get("air_quality") or {}
    if aq.get("available"):
        aqi = _num(aq.get("aqi"))
        pm25 = _num(aq.get("pm25"))
        all_indicators["pollution_risk"] = _risk_from(aqi, 50, 100)
        all_indicators["particulate_matter_risk"] = _risk_from(pm25, 25, 55)
        all_indicators["ozone_risk"] = _risk_from(_num(aq.get("o3")), 100, 180)

    derived = {key: all_indicators[key] for key in wanted if key in all_indicators}

    if parsed.get("activity") in {"pesticide_spraying", "fungicide_spraying"}:
        window = _find_spray_window(hourly)
        if window:
            derived["suitable_spray_window"] = window
        else:
            derived["suitable_spray_window"] = "none_in_next_24h"

    derived["_inputs"] = {
        "precipitation_probability": pop,
        "precipitation_mm": rain,
        "wind_speed_kmh": wind,
        "wind_gust_kmh": gust,
        "temp_max_c": tmax,
        "temp_min_c": tmin,
        "humidity_percent": humidity,
        "thunderstorm": storm,
    }
    return derived
