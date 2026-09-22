"""Flood & Disaster role — interprets existing NWP hazard assessments.

Does not re-fetch GFS/ECMWF and does not recompute NWP severity.
Does not predict floods or cyclones. Distinguishes official warnings
from WeatherGPT's NWP Hazard Assessment.
"""
from __future__ import annotations

from typing import Any, Optional

from app.services.nwp_hazards import SEVERITY_RANK, build_role_advisory


HAZARD_LABELS = {
    "heavy_rain": "Extreme rainfall",
    "strong_wind": "Strong wind",
    "convective": "Thunderstorm / convective conditions",
    "extreme_heat": "Extreme heat",
    "cyclone_related": "Cyclone-related conditions",
}

FORBIDDEN_CLAIMS = (
    "A flood will occur",
    "A cyclone will hit this location",
    "This area will definitely flood",
    "Evacuate immediately",
)


def normalize_official_warnings(
    alert_context: Optional[list[dict[str, Any]]],
) -> dict[str, Any]:
    """Official warnings come only from the caller (MERN/IMD). Mock JSON is never used."""
    alerts = [item for item in (alert_context or []) if isinstance(item, dict)]
    if not alerts:
        return {
            "present": False,
            "source": "none",
            "status_text": "No official warning available through the current system.",
            "warnings": [],
        }
    summaries = []
    for item in alerts:
        summaries.append(
            {
                "headline": item.get("headline") or item.get("title"),
                "severity": item.get("severity") or item.get("level"),
                "hazard": item.get("hazard") or item.get("event"),
                "issued_by": item.get("issued_by") or item.get("source"),
                "instruction": item.get("instruction"),
            }
        )
    return {
        "present": True,
        "source": "backend_context",
        "status_text": "Official warning supplied by the application backend.",
        "warnings": summaries,
    }


def _forecast_max_temp(nwp: dict[str, Any]) -> Optional[float]:
    stats = nwp.get("model_stats") or {}
    values = []
    for model in ("gfs", "ecmwf"):
        h24 = ((stats.get(model) or {}).get("h24")) or {}
        tmax = h24.get("max_temperature_c")
        if tmax is not None:
            values.append(float(tmax))
    return max(values) if values else None


def _rainfall_concern(hazards: list[dict[str, Any]]) -> Optional[str]:
    rain = next((h for h in hazards if h.get("type") == "heavy_rain"), None)
    if not rain:
        return None
    gfs_mm = (rain.get("forecast_total_mm_24h") or {}).get("gfs")
    ecm_mm = (rain.get("forecast_total_mm_24h") or {}).get("ecmwf")
    hourly = rain.get("max_hourly_mm") or {}
    parts = [
        "These rainfall conditions may increase the risk of waterlogging or flooding, "
        "particularly in vulnerable/low-lying areas."
    ]
    if gfs_mm is not None or ecm_mm is not None:
        parts.append(
            f"24h NWP rainfall totals — GFS: {gfs_mm} mm; ECMWF: {ecm_mm} mm."
        )
    g_hour = hourly.get("gfs")
    e_hour = hourly.get("ecmwf")
    if g_hour is not None or e_hour is not None:
        parts.append(
            f"Peak hourly precipitation — GFS: {g_hour} mm; ECMWF: {e_hour} mm."
        )
    parts.append(
        "This is not a flood prediction. Stronger claims require an official warning "
        "or a validated flood model, which this system does not have."
    )
    return " ".join(parts)


def _agreement_text(label: Optional[str]) -> str:
    if label == "high":
        return (
            "Both forecast models indicate similar hazardous conditions. "
            "Agreement is forecast consistency, not a probability."
        )
    if label == "moderate":
        return (
            "The forecast models are only moderately consistent, so intensity/timing "
            "still has uncertainty. This is not a probability."
        )
    if label == "low":
        return (
            "The forecast models show significant differences, so the timing/intensity "
            "of the hazard remains uncertain. This is not a probability."
        )
    if label == "single_model":
        return (
            "Only one NWP model was available, so model agreement cannot be assessed."
        )
    return "Model agreement is unavailable because NWP data is missing."


def _hazard_facts(hz: dict[str, Any]) -> dict[str, Any]:
    htype = hz.get("type")
    facts: dict[str, Any] = {
        "type": htype,
        "label": HAZARD_LABELS.get(htype, htype),
        "severity": hz.get("severity"),
        "model_agreement": hz.get("model_agreement"),
        "peak_time": hz.get("peak_time"),
        "gfs_value": hz.get("gfs_value"),
        "ecmwf_value": hz.get("ecmwf_value"),
        "source_models": hz.get("source_models"),
        "official_warning": False,
    }
    if htype == "heavy_rain":
        facts["gfs_rainfall_mm"] = (hz.get("forecast_total_mm_24h") or {}).get("gfs")
        facts["ecmwf_rainfall_mm"] = (hz.get("forecast_total_mm_24h") or {}).get("ecmwf")
        facts["max_hourly_mm"] = hz.get("max_hourly_mm")
        facts["concern"] = (
            "elevated waterlogging / flood *risk* from rainfall conditions — not a flood forecast"
        )
    elif htype == "strong_wind":
        facts["max_wind_kmh"] = hz.get("max_wind_kmh")
        facts["max_gust_kmh"] = hz.get("max_gust_kmh")
    elif htype == "convective":
        facts["max_cape_jkg"] = hz.get("max_cape_jkg")
        facts["max_thunderstorm_probability"] = hz.get("max_thunderstorm_probability")
        facts["note"] = hz.get("note")
    elif htype == "extreme_heat":
        facts["max_temperature_c"] = hz.get("max_temperature_c")
    elif htype == "cyclone_related":
        facts["min_pressure_hpa"] = hz.get("min_pressure_hpa")
        facts["pressure_drop_hpa"] = hz.get("pressure_drop_hpa")
        facts["note"] = hz.get("note")
    return facts


def _situation_text(location_name: Optional[str], hazards: list[dict[str, Any]], overall: str) -> str:
    place = location_name or "the requested location"
    if not hazards:
        return (
            f"Disaster Weather Assessment for {place}: NWP screening does not currently "
            f"flag developing hazardous conditions (overall risk: {overall})."
        )
    if len(hazards) == 1:
        hz = hazards[0]
        return (
            f"Disaster Weather Assessment for {place}: a developing "
            f"{HAZARD_LABELS.get(hz.get('type'), hz.get('type'))} hazard "
            f"(severity {hz.get('severity')}) is indicated by NWP."
        )
    names = "; ".join(
        f"{HAZARD_LABELS.get(h.get('type'), h.get('type'))} ({h.get('severity')})"
        for h in hazards
    )
    return (
        f"Disaster Weather Assessment for {place}: multiple hazardous weather conditions "
        f"are developing — {names}."
    )


def build_disaster_assessment(
    nwp: dict[str, Any],
    official_warnings: Optional[list[dict[str, Any]]] = None,
    location_name: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> dict[str, Any]:
    """Interpret an existing NWP assessment for the Flood & Disaster role."""
    official = normalize_official_warnings(official_warnings)
    loc = location_name or (nwp.get("location") or {}).get("name")

    if nwp.get("error") or nwp.get("available") is False:
        return {
            "available": False,
            "role": "flood_disaster",
            "assessment_name": "WeatherGPT Risk Assessment",
            "official_warning": False,
            "official_warning_status": official,
            "location": loc,
            "error": nwp.get("error") or "NWP hazard assessment unavailable.",
            "disclaimer": (
                "WeatherGPT does not replace official meteorological warnings. "
                "No disaster-hazard claim can be made without NWP data."
            ),
            "forbidden_claims": list(FORBIDDEN_CLAIMS),
        }

    hazards = list(nwp.get("hazards") or [])
    ranked = sorted(
        hazards, key=lambda h: SEVERITY_RANK.get(h.get("severity"), 0), reverse=True
    )
    facts = [_hazard_facts(h) for h in ranked]
    rainfall_concern = _rainfall_concern(ranked)
    tmax = _forecast_max_temp(nwp)
    live_hist = None
    nwp_rain = None
    rain_hz = next((h for h in ranked if h.get("type") == "heavy_rain"), None)
    if rain_hz:
        totals = rain_hz.get("forecast_total_mm_24h") or {}
        vals = [v for v in (totals.get("gfs"), totals.get("ecmwf")) if v is not None]
        if vals:
            nwp_rain = max(vals)
    if latitude is not None and longitude is not None:
        try:
            from app.services.historical_analysis import nwp_vs_archive_context

            live_hist = nwp_vs_archive_context(
                float(latitude), float(longitude), loc, nwp_rain, tmax
            )
        except Exception:
            live_hist = {"available": False, "error": "Live archive baseline unavailable."}
    if live_hist and live_hist.get("available"):
        baseline = {
            "available": True,
            "source": live_hist.get("source"),
            "same_month_metrics": live_hist.get("same_month_metrics"),
            "nwp_vs_rainfall_baseline": live_hist.get("nwp_vs_rainfall_baseline"),
            "nwp_vs_temperature_baseline": live_hist.get("nwp_vs_temperature_baseline"),
            "note": "ERA5 reanalysis same-month window, not an official climate normal.",
        }
        heat_cmp = live_hist.get("nwp_vs_temperature_baseline")
        if heat_cmp:
            heat_vs_baseline = (
                f"Forecast temperature is approximately {heat_cmp['difference_c']}°C "
                f"{'above' if heat_cmp['difference_c'] >= 0 else 'below'} the ERA5 "
                f"same-month mean ({heat_cmp['historical_mean_c']}°C)."
            )
        else:
            heat_vs_baseline = None
        rain_cmp = live_hist.get("nwp_vs_rainfall_baseline")
        if rain_cmp and rainfall_concern:
            rainfall_concern = rainfall_concern + " " + rain_cmp.get("text", "")
        elif rain_cmp:
            rainfall_concern = rain_cmp.get("text")
    else:
        baseline = {
            "available": False,
            "note": (
                "ERA5 historical baseline requires latitude/longitude. "
                "No mock station climatology is used."
            ),
        }
        heat_vs_baseline = None

    advisory = build_role_advisory(nwp, role="flood_disaster")
    overall = nwp.get("overall_risk") or "normal"
    agreement = nwp.get("model_agreement")

    return {
        "available": True,
        "role": "flood_disaster",
        "assessment_name": "WeatherGPT Risk Assessment",
        "nwp_assessment_name": nwp.get("assessment_name") or "NWP Hazard Assessment",
        "official_warning": False,
        "official_warning_status": official,
        "location": loc,
        "situation": _situation_text(loc, ranked, overall),
        "developing_hazards": facts,
        "overall_risk": overall,
        "model_agreement": agreement,
        "model_agreement_text": _agreement_text(agreement),
        "forecast_window": nwp.get("forecast_window"),
        "available_models": nwp.get("available_models") or [],
        "rainfall_concern": rainfall_concern,
        "historical_baseline": baseline,
        "heat_vs_baseline": heat_vs_baseline,
        "advisory": advisory,
        "disclaimer": nwp.get("disclaimer"),
        "forbidden_claims": list(FORBIDDEN_CLAIMS),
        "structure": [
            "current_situation",
            "developing_hazards",
            "severity_risk",
            "forecast_time_window",
            "nwp_model_agreement",
            "practical_advisory",
            "official_warning_status",
        ],
    }


def format_disaster_context_block(assessment: dict[str, Any]) -> str:
    """Plain-text Gemini block. Numerical facts are copied from NWP only."""
    import json

    if not assessment.get("available"):
        return (
            "[FLOOD & DISASTER ASSESSMENT UNAVAILABLE]\n"
            f"{assessment.get('error')}\n"
            "Do NOT invent rainfall, wind, CAPE, floods, cyclones, or official warnings."
        )
    compact = {
        "assessment_name": assessment.get("assessment_name"),
        "nwp_assessment_name": assessment.get("nwp_assessment_name"),
        "official_warning": False,
        "official_warning_status": assessment.get("official_warning_status"),
        "location": assessment.get("location"),
        "situation": assessment.get("situation"),
        "developing_hazards": assessment.get("developing_hazards"),
        "overall_risk": assessment.get("overall_risk"),
        "model_agreement": assessment.get("model_agreement"),
        "model_agreement_text": assessment.get("model_agreement_text"),
        "forecast_window": assessment.get("forecast_window"),
        "available_models": assessment.get("available_models"),
        "rainfall_concern": assessment.get("rainfall_concern"),
        "historical_baseline": assessment.get("historical_baseline"),
        "heat_vs_baseline": assessment.get("heat_vs_baseline"),
        "advisory": assessment.get("advisory"),
        "disclaimer": assessment.get("disclaimer"),
        "forbidden_claims": assessment.get("forbidden_claims"),
    }
    return (
        "[FLOOD & DISASTER ROLE — interpret structured NWP facts only]\n"
        "Reply as a disaster-management assessment, not a normal weather chatbot.\n"
        "Required structure: Current situation → Developing hazards → Severity/risk → "
        "Forecast window → NWP model agreement → Practical advisory → Official warning status.\n"
        "Keep every millimetre, km/h, CAPE, temperature, and pressure exactly as given.\n"
        "Do NOT invent values, official warnings, floods, cyclone landfall, evacuations, "
        "or confidence percentages. Do NOT change severity. "
        "If official_warning_status.present is false, say no official warning is available "
        "through the current system. If present is true, quote those headlines separately "
        "from the WeatherGPT NWP assessment.\n"
        "Do not claim a flood or cyclone will occur.\n"
        + json.dumps(compact, ensure_ascii=False, default=str)
    )


def compact_disaster_for_ui(assessment: dict[str, Any]) -> dict[str, Any]:
    """Fields the MERN UI can badge without a separate architecture."""
    official = assessment.get("official_warning_status") or {}
    hazards = assessment.get("developing_hazards") or []
    return {
        "role": "flood_disaster",
        "location": assessment.get("location"),
        "hazards": [
            {
                "type": h.get("type"),
                "label": h.get("label"),
                "severity": h.get("severity"),
            }
            for h in hazards
        ],
        "overall_risk": assessment.get("overall_risk"),
        "forecast_window": assessment.get("forecast_window"),
        "nwp_models": assessment.get("available_models"),
        "model_agreement": assessment.get("model_agreement"),
        "official_warning": False,
        "official_warning_present": bool(official.get("present")),
        "official_warning_status": official.get("status_text"),
        "advisory": assessment.get("advisory"),
        "available": assessment.get("available"),
        "error": assessment.get("error"),
    }
