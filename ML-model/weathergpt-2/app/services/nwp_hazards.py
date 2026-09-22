"""Rules-based NWP hazard detection, model agreement, and role advisories.

This is a WeatherGPT risk-assessment layer. It is NOT an official warning service
and does not predict floods or cyclones.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.core.nwp_config import threshold
from app.services.nwp import get_nwp_forecasts


SEVERITY_RANK = {"none": 0, "watch": 1, "moderate": 2, "high": 3}
OVERALL_RANK = {"normal": 0, "watch": 1, "elevated": 2, "high": 3}


def _val(row: dict[str, Any], key: str) -> float:
    value = row.get(key)
    try:
        return float(value) if value is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _rolling_max_sum(values: list[float], window: int) -> float:
    if not values:
        return 0.0
    width = min(window, len(values))
    return max(sum(values[i : i + width]) for i in range(0, len(values) - width + 1))


def aggregate_model_window(hourly: list[dict[str, Any]], hours: int) -> dict[str, Any]:
    """Sum/max stats over the first `hours` rows (typically 24 or 48)."""
    rows = hourly[: max(1, hours)]
    precip = [_val(r, "precipitation_mm") for r in rows]
    rain = [_val(r, "rain_mm") for r in rows]
    wind = [_val(r, "wind_speed_kmh") for r in rows]
    gust = [_val(r, "wind_gust_kmh") for r in rows]
    cape = [_val(r, "cape_jkg") for r in rows]
    temps = [
        float(r["temperature_c"])
        for r in rows
        if r.get("temperature_c") is not None
    ]
    pressure = [
        float(r["pressure_hpa"])
        for r in rows
        if r.get("pressure_hpa") is not None
    ]
    pop = [
        float(r["precipitation_probability"])
        for r in rows
        if r.get("precipitation_probability") is not None
    ]
    tsp = [
        float(r["thunderstorm_probability"])
        for r in rows
        if r.get("thunderstorm_probability") is not None
    ]

    def peak(series: list[float], field_fallback: list[float] | None = None) -> tuple[float, Optional[str]]:
        use = series if any(series) else (field_fallback or series)
        if not use:
            return 0.0, None
        idx = max(range(len(use)), key=lambda i: use[i])
        return use[idx], rows[idx].get("time") if idx < len(rows) else None

    max_hourly, peak_rain_time = peak(precip)
    max_wind, peak_wind_time = peak(wind)
    max_gust, peak_gust_time = peak(gust)
    max_cape, peak_cape_time = peak(cape)
    max_temp, peak_temp_time = peak(temps)
    min_pressure = min(pressure) if pressure else None
    pressure_drop = None
    if pressure:
        pressure_drop = round(pressure[0] - min(pressure), 1)

    start = rows[0].get("time") if rows else None
    end = rows[-1].get("time") if rows else None
    return {
        "hours": len(rows),
        "start": start,
        "end": end,
        "precip_total_mm": round(sum(precip), 2),
        "rain_total_mm": round(sum(rain), 2),
        "max_hourly_precip_mm": round(max_hourly, 2),
        "peak_precip_time": peak_rain_time,
        "precip_6h_max_mm": round(_rolling_max_sum(precip, 6), 2),
        "precip_12h_max_mm": round(_rolling_max_sum(precip, 12), 2),
        "precip_24h_mm": round(sum(precip[:24]), 2),
        "precip_48h_mm": round(sum(precip[:48]), 2),
        "max_precip_probability": round(max(pop), 1) if pop else None,
        "max_wind_kmh": round(max_wind, 1),
        "peak_wind_time": peak_wind_time,
        "max_gust_kmh": round(max_gust, 1),
        "peak_gust_time": peak_gust_time,
        "max_cape_jkg": round(max_cape, 1),
        "peak_cape_time": peak_cape_time,
        "max_thunderstorm_probability": round(max(tsp), 1) if tsp else None,
        "max_temperature_c": round(max_temp, 1) if temps else None,
        "peak_temp_time": peak_temp_time,
        "min_pressure_hpa": round(min_pressure, 1) if min_pressure is not None else None,
        "pressure_drop_hpa": pressure_drop,
    }


def classify_rain_severity(stats: dict[str, Any]) -> str:
    p24 = stats.get("precip_24h_mm") or 0.0
    p1 = stats.get("max_hourly_precip_mm") or 0.0
    p6 = stats.get("precip_6h_max_mm") or 0.0
    p12 = stats.get("precip_12h_max_mm") or 0.0
    if p24 >= threshold("extreme_rain_24h_mm") or p1 >= threshold("extreme_rain_1h_mm"):
        return "high"
    if p24 >= threshold("very_heavy_rain_24h_mm"):
        return "high"
    if (
        p24 >= threshold("heavy_rain_24h_mm")
        or p6 >= threshold("heavy_rain_6h_mm")
        or p12 >= threshold("heavy_rain_12h_mm")
        or p1 >= threshold("heavy_rain_1h_mm")
    ):
        return "moderate"
    if p24 >= threshold("rain_watch_24h_mm"):
        return "watch"
    return "none"


def classify_wind_severity(stats: dict[str, Any]) -> str:
    wind = stats.get("max_wind_kmh") or 0.0
    gust = stats.get("max_gust_kmh") or 0.0
    if wind >= threshold("extreme_wind_kmh") or gust >= threshold("extreme_gust_kmh"):
        return "high"
    if wind >= threshold("gale_wind_kmh") or gust >= threshold("gale_gust_kmh"):
        return "high"
    if wind >= threshold("strong_wind_kmh") or gust >= threshold("strong_gust_kmh"):
        return "moderate"
    return "none"


def classify_convective_severity(stats: dict[str, Any]) -> str:
    """CAPE is an environment indicator only — never treated as a storm forecast."""
    cape = stats.get("max_cape_jkg") or 0.0
    tsp = stats.get("max_thunderstorm_probability")
    heavy_hour = (stats.get("max_hourly_precip_mm") or 0.0) >= threshold("heavy_rain_1h_mm")
    gusty = (stats.get("max_gust_kmh") or 0.0) >= threshold("strong_gust_kmh")
    signals = 0
    if cape >= threshold("cape_watch_jkg"):
        signals += 1
    if tsp is not None and tsp >= threshold("thunderstorm_probability_watch"):
        signals += 1
    if heavy_hour:
        signals += 1
    if gusty:
        signals += 1
    if signals == 0:
        return "none"
    if (
        cape >= threshold("cape_high_jkg")
        and (heavy_hour or gusty or (tsp is not None and tsp >= threshold("thunderstorm_probability_high")))
    ):
        return "high"
    if signals >= 2 and cape >= threshold("cape_elevated_jkg"):
        return "moderate"
    if cape >= threshold("cape_watch_jkg") or (tsp is not None and tsp >= threshold("thunderstorm_probability_watch")):
        return "watch"
    return "none"


def classify_heat_severity(stats: dict[str, Any]) -> str:
    """Absolute NWP temperature screen — not an IMD heatwave warning."""
    tmax = stats.get("max_temperature_c")
    if tmax is None:
        return "none"
    if tmax >= threshold("extreme_heat_c"):
        return "high"
    if tmax >= threshold("very_hot_c"):
        return "moderate"
    if tmax >= threshold("heat_watch_c"):
        return "watch"
    return "none"


def classify_cyclone_related_severity(
    stats: dict[str, Any],
    rain_severity: str,
    wind_severity: str,
) -> str:
    """Combination screen for cyclone-*related* conditions.

    Does NOT detect, name, or predict a cyclone. Requires strong wind plus
    rainfall plus a pressure signal together.
    """
    wind_ok = SEVERITY_RANK.get(wind_severity, 0) >= SEVERITY_RANK["moderate"]
    rain_ok = SEVERITY_RANK.get(rain_severity, 0) >= SEVERITY_RANK["watch"]
    min_p = stats.get("min_pressure_hpa")
    drop = stats.get("pressure_drop_hpa") or 0.0
    pressure_signal = False
    if min_p is not None and min_p <= threshold("cyclone_low_pressure_hpa"):
        pressure_signal = True
    if drop >= threshold("cyclone_pressure_drop_hpa"):
        pressure_signal = True
    if not (wind_ok and rain_ok and pressure_signal):
        return "none"
    if SEVERITY_RANK.get(wind_severity, 0) >= SEVERITY_RANK["high"] and SEVERITY_RANK.get(
        rain_severity, 0
    ) >= SEVERITY_RANK["moderate"]:
        return "high"
    return "moderate"


def model_agreement(gfs_value: Optional[float], ecmwf_value: Optional[float]) -> str:
    """Consistency of two model numbers — not a probability."""
    g_ok = gfs_value is not None
    e_ok = ecmwf_value is not None
    if g_ok and not e_ok:
        return "single_model"
    if e_ok and not g_ok:
        return "single_model"
    if not g_ok and not e_ok:
        return "unavailable"
    a = float(gfs_value or 0.0)
    b = float(ecmwf_value or 0.0)
    denom = max(abs(a), abs(b), 1.0)
    rel = abs(a - b) / denom
    if rel <= threshold("agreement_high_rel_diff"):
        return "high"
    if rel <= threshold("agreement_moderate_rel_diff"):
        return "moderate"
    return "low"


def _pick_peak(*times: Optional[str]) -> Optional[str]:
    for ts in times:
        if ts:
            return ts
    return None


def _merge_severity(a: str, b: str) -> str:
    return a if SEVERITY_RANK.get(a, 0) >= SEVERITY_RANK.get(b, 0) else b


def analyze_nwp_hazards(bundle: dict[str, Any]) -> dict[str, Any]:
    """Deterministic hazard assessment from a get_nwp_forecasts() bundle."""
    models = bundle.get("models") or {}
    gfs = models.get("gfs") or {}
    ecmwf = models.get("ecmwf") or {}
    gfs_ok = bool(gfs.get("available") and gfs.get("hourly"))
    ecmwf_ok = bool(ecmwf.get("available") and ecmwf.get("hourly"))

    gfs_24 = aggregate_model_window(gfs.get("hourly") or [], 24) if gfs_ok else None
    gfs_48 = aggregate_model_window(gfs.get("hourly") or [], 48) if gfs_ok else None
    ecm_24 = aggregate_model_window(ecmwf.get("hourly") or [], 24) if ecmwf_ok else None
    ecm_48 = aggregate_model_window(ecmwf.get("hourly") or [], 48) if ecmwf_ok else None

    hazards: list[dict[str, Any]] = []

    def add_hazard(
        htype: str,
        g_sev: str,
        e_sev: str,
        g_val: Optional[float],
        e_val: Optional[float],
        extra: dict[str, Any],
    ) -> None:
        merged = _merge_severity(g_sev if gfs_ok else "none", e_sev if ecmwf_ok else "none")
        if merged == "none":
            return
        sources = []
        if gfs_ok and g_sev != "none":
            sources.append("GFS")
        if ecmwf_ok and e_sev != "none":
            sources.append("ECMWF")
        if not sources:
            return
        hazards.append(
            {
                "type": htype,
                "severity": merged,
                "model_agreement": model_agreement(g_val, e_val),
                "gfs_value": g_val if gfs_ok else None,
                "ecmwf_value": e_val if ecmwf_ok else None,
                "source_models": sources,
                "official_warning": False,
                **extra,
            }
        )

    add_hazard(
        "heavy_rain",
        classify_rain_severity(gfs_24 or {}),
        classify_rain_severity(ecm_24 or {}),
        (gfs_24 or {}).get("precip_24h_mm"),
        (ecm_24 or {}).get("precip_24h_mm"),
        {
            "forecast_total_mm_24h": {
                "gfs": (gfs_24 or {}).get("precip_24h_mm"),
                "ecmwf": (ecm_24 or {}).get("precip_24h_mm"),
            },
            "forecast_total_mm_48h": {
                "gfs": (gfs_48 or {}).get("precip_48h_mm"),
                "ecmwf": (ecm_48 or {}).get("precip_48h_mm"),
            },
            "max_hourly_mm": {
                "gfs": (gfs_24 or {}).get("max_hourly_precip_mm"),
                "ecmwf": (ecm_24 or {}).get("max_hourly_precip_mm"),
            },
            "peak_time": _pick_peak(
                (gfs_24 or {}).get("peak_precip_time"),
                (ecm_24 or {}).get("peak_precip_time"),
            ),
        },
    )
    add_hazard(
        "strong_wind",
        classify_wind_severity(gfs_24 or {}),
        classify_wind_severity(ecm_24 or {}),
        (gfs_24 or {}).get("max_gust_kmh") or (gfs_24 or {}).get("max_wind_kmh"),
        (ecm_24 or {}).get("max_gust_kmh") or (ecm_24 or {}).get("max_wind_kmh"),
        {
            "max_wind_kmh": {
                "gfs": (gfs_24 or {}).get("max_wind_kmh"),
                "ecmwf": (ecm_24 or {}).get("max_wind_kmh"),
            },
            "max_gust_kmh": {
                "gfs": (gfs_24 or {}).get("max_gust_kmh"),
                "ecmwf": (ecm_24 or {}).get("max_gust_kmh"),
            },
            "peak_time": _pick_peak(
                (gfs_24 or {}).get("peak_gust_time"),
                (ecm_24 or {}).get("peak_gust_time"),
                (gfs_24 or {}).get("peak_wind_time"),
                (ecm_24 or {}).get("peak_wind_time"),
            ),
        },
    )
    add_hazard(
        "convective",
        classify_convective_severity(gfs_24 or {}),
        classify_convective_severity(ecm_24 or {}),
        (gfs_24 or {}).get("max_cape_jkg"),
        (ecm_24 or {}).get("max_cape_jkg"),
        {
            "max_cape_jkg": {
                "gfs": (gfs_24 or {}).get("max_cape_jkg"),
                "ecmwf": (ecm_24 or {}).get("max_cape_jkg"),
            },
            "max_thunderstorm_probability": {
                "gfs": (gfs_24 or {}).get("max_thunderstorm_probability"),
                "ecmwf": (ecm_24 or {}).get("max_thunderstorm_probability"),
            },
            "peak_time": _pick_peak(
                (gfs_24 or {}).get("peak_cape_time"),
                (ecm_24 or {}).get("peak_cape_time"),
            ),
            "note": (
                "Convective signal uses CAPE plus rain/gusts/probability when present. "
                "CAPE alone does not mean a thunderstorm will occur."
            ),
        },
    )
    add_hazard(
        "extreme_heat",
        classify_heat_severity(gfs_24 or {}),
        classify_heat_severity(ecm_24 or {}),
        (gfs_24 or {}).get("max_temperature_c"),
        (ecm_24 or {}).get("max_temperature_c"),
        {
            "max_temperature_c": {
                "gfs": (gfs_24 or {}).get("max_temperature_c"),
                "ecmwf": (ecm_24 or {}).get("max_temperature_c"),
            },
            "peak_time": _pick_peak(
                (gfs_24 or {}).get("peak_temp_time"),
                (ecm_24 or {}).get("peak_temp_time"),
            ),
            "note": (
                "Absolute 2 m temperature screen from NWP. This is not an official "
                "heatwave warning."
            ),
        },
    )
    g_rain_sev = classify_rain_severity(gfs_24 or {}) if gfs_ok else "none"
    e_rain_sev = classify_rain_severity(ecm_24 or {}) if ecmwf_ok else "none"
    g_wind_sev = classify_wind_severity(gfs_24 or {}) if gfs_ok else "none"
    e_wind_sev = classify_wind_severity(ecm_24 or {}) if ecmwf_ok else "none"
    add_hazard(
        "cyclone_related",
        classify_cyclone_related_severity(gfs_24 or {}, g_rain_sev, g_wind_sev),
        classify_cyclone_related_severity(ecm_24 or {}, e_rain_sev, e_wind_sev),
        (gfs_24 or {}).get("min_pressure_hpa"),
        (ecm_24 or {}).get("min_pressure_hpa"),
        {
            "min_pressure_hpa": {
                "gfs": (gfs_24 or {}).get("min_pressure_hpa"),
                "ecmwf": (ecm_24 or {}).get("min_pressure_hpa"),
            },
            "pressure_drop_hpa": {
                "gfs": (gfs_24 or {}).get("pressure_drop_hpa"),
                "ecmwf": (ecm_24 or {}).get("pressure_drop_hpa"),
            },
            "peak_time": _pick_peak(
                (gfs_24 or {}).get("peak_gust_time"),
                (ecm_24 or {}).get("peak_gust_time"),
            ),
            "note": (
                "Combination of strong wind, rainfall, and low/falling pressure. "
                "This does not mean a cyclone exists or will make landfall."
            ),
        },
    )

    overall = "normal"
    for hz in hazards:
        sev = hz.get("severity")
        if sev == "high":
            overall = "high" if OVERALL_RANK[overall] < OVERALL_RANK["high"] else overall
        elif sev == "moderate":
            if OVERALL_RANK[overall] < OVERALL_RANK["elevated"]:
                overall = "elevated"
        elif sev == "watch":
            if OVERALL_RANK[overall] < OVERALL_RANK["watch"]:
                overall = "watch"

    if hazards:
        top = max(hazards, key=lambda h: SEVERITY_RANK.get(h.get("severity"), 0))
        agreement = top.get("model_agreement")
    else:
        agreement = model_agreement(
            (gfs_24 or {}).get("precip_24h_mm") if gfs_ok else None,
            (ecm_24 or {}).get("precip_24h_mm") if ecmwf_ok else None,
        )

    window_start = (gfs_24 or ecm_24 or {}).get("start")
    window_end_24 = (gfs_24 or ecm_24 or {}).get("end")
    window_end_48 = (gfs_48 or ecm_48 or {}).get("end")

    return {
        "assessment_name": "NWP Hazard Assessment",
        "official_warning": False,
        "disclaimer": (
            "WeatherGPT does not replace official meteorological warnings. "
            "This NWP hazard assessment is a decision-support layer that helps "
            "interpret forecast conditions."
        ),
        "overall_risk": overall,
        "model_agreement": agreement,
        "available_models": bundle.get("available_models") or [],
        "forecast_window": {
            "hours_requested": bundle.get("forecast_hours"),
            "start": window_start,
            "end_24h": window_end_24,
            "end_48h": window_end_48,
        },
        "model_stats": {
            "gfs": {"h24": gfs_24, "h48": gfs_48, "available": gfs_ok},
            "ecmwf": {"h24": ecm_24, "h48": ecm_48, "available": ecmwf_ok},
        },
        "hazards": hazards,
    }


ROLE_ADVISORIES: dict[str, dict[str, str]] = {
    "citizen": {
        "heavy_rain": (
            "Heavy rainfall is indicated in the NWP forecast for your area over the next 24 hours. "
            "Keep updated with local official advisories and avoid unnecessary travel during intense rainfall."
        ),
        "strong_wind": (
            "Strong winds are indicated over the next 24 hours. Secure loose outdoor items and "
            "expect possible travel disruption. This is not an official warning."
        ),
        "convective": (
            "The forecast environment is favorable for thunderstorms (elevated CAPE and/or rain/gusts). "
            "That does not guarantee a storm. Stay alert to official updates."
        ),
        "extreme_heat": (
            "NWP indicates very high temperatures over the next 24 hours. Limit prolonged outdoor "
            "exposure, stay hydrated, and monitor local heat advisories. This is not an official heatwave warning."
        ),
        "cyclone_related": (
            "NWP shows a combination of strong wind, rainfall, and low/falling pressure. "
            "This does not mean a cyclone exists. Monitor official cyclone and disaster-management advisories."
        ),
        "normal": "NWP models do not currently indicate hazardous rainfall or wind over the next 24 hours.",
    },
    "farmer": {
        "heavy_rain": (
            "Heavy rainfall is indicated over the next 24 hours. Consider postponing irrigation and "
            "protect harvested crops from exposure to rain if a dry, covered store is available."
        ),
        "strong_wind": (
            "Strong winds/gusts are indicated. Standing mature crops may face lodging risk; "
            "avoid spraying during high gusts."
        ),
        "convective": (
            "NWP shows an elevated convective environment (CAPE). That does not mean a thunderstorm "
            "will occur. Delay spraying if local storms develop; this is not an official warning."
        ),
        "extreme_heat": (
            "Very high temperatures are indicated. Livestock and field workers may face heat stress; "
            "this is not an official heatwave warning."
        ),
        "cyclone_related": (
            "Strong wind plus heavy rain and pressure fall are indicated together. This is not a cyclone "
            "forecast. Secure harvested produce and monitor official advisories."
        ),
        "normal": "No NWP heavy-rain or strong-wind screen is currently triggered for farm operations.",
    },
    "disaster": {
        "heavy_rain": (
            "Heavy rainfall is expected over the next 24 hours. Areas with poor drainage may experience "
            "waterlogging. Monitor local official advisories and avoid unnecessary travel during periods "
            "of intense rainfall. This is not a flood prediction and not an official alert."
        ),
        "strong_wind": (
            "Strong winds are expected. Secure loose outdoor objects and monitor official warnings, "
            "particularly in exposed areas. Do not treat this as an emergency order."
        ),
        "convective": (
            "Thunderstorm-favorable conditions are present. Avoid exposed outdoor areas during lightning "
            "activity and monitor official advisories. CAPE alone does not mean a storm will occur."
        ),
        "extreme_heat": (
            "Very high temperatures are expected. Limit prolonged outdoor exposure, stay hydrated, and "
            "monitor local heat advisories. This is not an official heatwave warning."
        ),
        "cyclone_related": (
            "Strong winds and heavy rainfall are forecast together with low or falling pressure. "
            "Monitor official cyclone and disaster-management advisories. WeatherGPT does not independently "
            "claim that a cyclone exists or will make landfall."
        ),
        "normal": (
            "No NWP hazard screen is currently triggered. Continue routine monitoring of official sources."
        ),
    },
    "aviation": {
        "heavy_rain": (
            "NWP indicates heavy rain in the period. Expect possible operational disruption. "
            "Check latest METAR/TAF — this is not clearance or an official SIGMET."
        ),
        "strong_wind": (
            "NWP indicates strong wind/gusts. Crosswind and turbulence risk may rise. "
            "Verify official aviation weather before departure."
        ),
        "convective": (
            "Elevated CAPE/convective indicators are present. Thunderstorms are not guaranteed. "
            "Use official aviation convective products."
        ),
        "extreme_heat": "High temperatures are indicated. Density altitude and crew heat stress may rise. Check official aviation weather.",
        "cyclone_related": (
            "Combined wind, rain, and pressure signals are present. This is not a tropical-cyclone warning. "
            "Use official SIGMET/tropical products."
        ),
        "normal": "NWP screening does not currently flag heavy rain or strong wind for flight planning.",
    },
    "marine": {
        "heavy_rain": (
            "Heavy rain is indicated; visibility and squalls may accompany it. "
            "Reassess small-craft plans and check official marine warnings."
        ),
        "strong_wind": (
            "NWP indicates strong wind/gusts. Risk is higher for small boats than for large vessels. "
            "Consult official marine warnings; this is not a sail/no-sail order."
        ),
        "convective": (
            "Convective environment is elevated. Squalls are possible but not certain. "
            "Monitor official marine updates."
        ),
        "extreme_heat": "High temperatures are indicated on land; marine wind/wave remain the operational concern.",
        "cyclone_related": (
            "Strong wind, rain, and pressure fall together. This is not an official cyclone warning. "
            "Consult official marine/cyclone bulletins."
        ),
        "normal": "No NWP strong-wind or heavy-rain screen is currently triggered for marine operations.",
    },
    "urban_planner": {
        "heavy_rain": (
            "NWP indicates a period of substantial rainfall. The planning concern is short-duration "
            "intensity versus drainage capacity — this is not a mapped flood forecast."
        ),
        "strong_wind": (
            "Strong winds are indicated. Consider outdoor-event and street-furniture exposure. "
            "Not an official warning."
        ),
        "convective": (
            "Convective indicators are elevated. Intense short bursts of rain/wind are possible. "
            "Monitor official urban weather advisories."
        ),
        "extreme_heat": (
            "Very high temperatures are indicated. Heat-island and outdoor-worker exposure may rise. "
            "Not an official heatwave warning."
        ),
        "cyclone_related": (
            "Combined wind, rain, and pressure signals are present. This is not a cyclone landfall forecast."
        ),
        "normal": "NWP screening does not currently flag heavy rain or strong wind for urban operations.",
    },
    "researcher": {
        "heavy_rain": "NWP 24h precipitation totals exceed the prototype heavy-rain screen. See model_stats.",
        "strong_wind": "NWP wind/gust maxima exceed the prototype strong-wind screen. See model_stats.",
        "convective": "CAPE and supporting fields exceed the prototype convective screen. CAPE ≠ storm occurrence.",
        "extreme_heat": "NWP 2 m temperature exceeds the prototype heat screen. See model_stats.",
        "cyclone_related": "Combined wind/rain/pressure screen triggered. Not a cyclone identification.",
        "normal": "No prototype NWP hazard screen was triggered. See model_stats for raw aggregates.",
    },
    "air_quality": {
        "heavy_rain": (
            "Rain may wash out particulates, but AQI must come from measurements — do not infer AQI from NWP rain."
        ),
        "strong_wind": (
            "Strong winds often improve dispersion, but AQI still requires measured pollutants."
        ),
        "convective": "Convective mixing can change concentrations; use AQ observations, not NWP alone.",
        "extreme_heat": "Heat is an NWP temperature screen; do not infer AQI from it.",
        "cyclone_related": "Combined NWP wind/rain/pressure screen; AQI still requires measurements.",
        "normal": "No NWP rain/wind hazard screen; do not infer air quality from that absence.",
    },
    "climate_analyst": {
        "heavy_rain": "This is a short-range NWP rainfall screen, not a climate trend.",
        "strong_wind": "This is a short-range NWP wind screen, not a climate extreme analysis.",
        "convective": "Short-range convective environment only — not a climate signal.",
        "extreme_heat": "Short-range NWP temperature screen, not a climate heatwave analysis.",
        "cyclone_related": "Short-range combined wind/rain/pressure screen — not a cyclone climatology.",
        "normal": "No short-range NWP hazard screen; do not treat as a climatology result.",
    },
}


def _role_key(role: Optional[str]) -> str:
    raw = (role or "citizen").lower().replace(" ", "_").replace("/", "_")
    if raw in {"flood_disaster", "flood", "disaster_manager", "flood_and_disaster"}:
        return "disaster"
    aliases = {
        "farmer_crop_advisory": "farmer",
        "urban": "urban_planner",
        "climate": "climate_analyst",
        "aqi": "air_quality",
    }
    return aliases.get(raw, raw if raw in ROLE_ADVISORIES else "citizen")


def build_role_advisory(assessment: dict[str, Any], role: Optional[str] = None) -> str:
    key = _role_key(role)
    table = ROLE_ADVISORIES[key]
    hazards = assessment.get("hazards") or []
    if not hazards:
        return table["normal"]
    ranked = sorted(
        hazards, key=lambda h: SEVERITY_RANK.get(h.get("severity"), 0), reverse=True
    )
    top = ranked[0]
    htype = top.get("type") or "heavy_rain"
    text = table.get(htype) or table["normal"]
    if key == "disaster" and len(ranked) > 1:
        names = ", ".join(
            f"{h.get('type')} ({h.get('severity')})" for h in ranked
        )
        text = (
            f"Multiple hazardous weather conditions are developing: {names}. "
            + text
        )
    extra = (
        f" Overall NWP risk level: {assessment.get('overall_risk')}. "
        f"Model agreement: {assessment.get('model_agreement')}. "
        "Not an official meteorological warning."
    )
    return text + extra


def build_alert_objects(
    assessment: dict[str, Any],
    location_name: Optional[str],
    latitude: float,
    longitude: float,
) -> list[dict[str, Any]]:
    generated = datetime.now(timezone.utc).isoformat()
    alerts: list[dict[str, Any]] = []
    fw = assessment.get("forecast_window") or {}
    stats = assessment.get("model_stats") or {}
    for hz in assessment.get("hazards") or []:
        alerts.append(
            {
                "location": location_name,
                "latitude": latitude,
                "longitude": longitude,
                "hazard": hz.get("type"),
                "severity": hz.get("severity"),
                "forecast_window": f"{fw.get('start')} to {fw.get('end_24h')}",
                "gfs_rainfall_mm": (stats.get("gfs") or {}).get("h24", {}) and (stats["gfs"]["h24"] or {}).get("precip_24h_mm"),
                "ecmwf_rainfall_mm": (stats.get("ecmwf") or {}).get("h24", {}) and (stats["ecmwf"]["h24"] or {}).get("precip_24h_mm"),
                "gfs_value": hz.get("gfs_value"),
                "ecmwf_value": hz.get("ecmwf_value"),
                "model_agreement": hz.get("model_agreement"),
                "source": hz.get("source_models"),
                "peak_time": hz.get("peak_time"),
                "generated_at": generated,
                "official_warning": False,
                "assessment_name": "NWP Hazard Assessment",
            }
        )
    return alerts


def format_nwp_context_block(assessment: dict[str, Any], location_name: Optional[str]) -> str:
    """Plain text for Gemini. Contains only engine-produced numbers."""
    if assessment.get("error"):
        return (
            "[NWP HAZARD ASSESSMENT UNAVAILABLE]\n"
            f"{assessment.get('error')}\n"
            "Do NOT invent rainfall, wind, CAPE, warnings, floods, or cyclones."
        )
    import json

    compact = {
        "assessment_name": assessment.get("assessment_name"),
        "official_warning": False,
        "location": location_name,
        "overall_risk": assessment.get("overall_risk"),
        "model_agreement": assessment.get("model_agreement"),
        "available_models": assessment.get("available_models"),
        "forecast_window": assessment.get("forecast_window"),
        "hazards": assessment.get("hazards"),
        "model_stats": assessment.get("model_stats"),
        "disclaimer": assessment.get("disclaimer"),
        "role_advisory": assessment.get("advisory"),
    }
    return (
        "[NWP HAZARD ASSESSMENT — verified GFS/ECMWF numbers only]\n"
        "Explain these facts. Do NOT invent values, official warnings, floods, or cyclones. "
        "Do NOT change severity. Never say IMD has issued a warning unless alert_context says so.\n"
        + json.dumps(compact, ensure_ascii=False, default=str)
    )


def assess_nwp_hazards_for_location(
    latitude: float,
    longitude: float,
    location_name: Optional[str] = None,
    role: Optional[str] = None,
    hours: int = 48,
    use_cache: bool = True,
) -> dict[str, Any]:
    bundle = get_nwp_forecasts(latitude, longitude, hours=hours, use_cache=use_cache)
    if bundle.get("both_unavailable"):
        return {
            "available": False,
            "error": "Both GFS and ECMWF NWP requests failed. No hazard claim can be made.",
            "official_warning": False,
            "location": {
                "name": location_name,
                "latitude": latitude,
                "longitude": longitude,
            },
            "models": bundle.get("models"),
        }
    assessment = analyze_nwp_hazards(bundle)
    assessment["available"] = True
    assessment["location"] = {
        "name": location_name,
        "latitude": latitude,
        "longitude": longitude,
    }
    assessment["advisory"] = build_role_advisory(assessment, role)
    assessment["alerts"] = build_alert_objects(
        assessment, location_name, latitude, longitude
    )
    # Compact models for API: hourly kept but LLM block uses stats only
    assessment["models"] = {
        "gfs": {
            "available": (bundle.get("models") or {}).get("gfs", {}).get("available"),
            "error": (bundle.get("models") or {}).get("gfs", {}).get("error"),
            "hourly_count": (bundle.get("models") or {}).get("gfs", {}).get("hourly_count"),
            "source": (bundle.get("models") or {}).get("gfs", {}).get("source"),
        },
        "ecmwf": {
            "available": (bundle.get("models") or {}).get("ecmwf", {}).get("available"),
            "error": (bundle.get("models") or {}).get("ecmwf", {}).get("error"),
            "hourly_count": (bundle.get("models") or {}).get("ecmwf", {}).get("hourly_count"),
            "source": (bundle.get("models") or {}).get("ecmwf", {}).get("source"),
            "notes": (bundle.get("models") or {}).get("ecmwf", {}).get("notes"),
        },
    }
    return assessment
