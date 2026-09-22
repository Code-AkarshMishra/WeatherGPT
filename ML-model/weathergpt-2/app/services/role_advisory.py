"""Step 5 — advisory engine: impact, action, confidence, missing info."""
from __future__ import annotations

from typing import Any

from app.services.role_config import get_role_config


def _conf_label(score: float) -> str:
    if score >= 0.8:
        return "high"
    if score >= 0.55:
        return "medium"
    return "low"


def build_advisory(
    parsed: dict[str, Any],
    bundle: dict[str, Any],
    derived: dict[str, Any],
) -> dict[str, Any]:
    role = parsed.get("role") or "citizen"
    cfg = get_role_config(role)
    activity = parsed.get("activity") or "general weather use"
    missing = list(parsed.get("missing_information") or [])
    inputs = derived.get("_inputs") or {}
    location = (bundle.get("location") or {}).get("name") or parsed.get("location") or "the area"
    time_range = parsed.get("time_range") or "today"

    aq = (bundle.get("extras") or {}).get("air_quality") or {}
    if role == "air_quality" and not aq.get("available"):
        if "aq_measurements" not in missing:
            missing.append("aq_measurements")

    reasons: list[str] = []
    uncertainty: list[str] = [
        "Exact rainfall timing can still change as the forecast updates.",
    ]
    consider: list[str] = []
    avoid: list[str] = []

    rain_mm = inputs.get("precipitation_mm")
    pop = inputs.get("precipitation_probability")
    gust = inputs.get("wind_gust_kmh")
    storm = inputs.get("thunderstorm")
    if rain_mm is not None:
        reasons.append(f"Forecast rain about {rain_mm} mm over {time_range} in {location}.")
    if pop is not None:
        reasons.append(f"Rain chance around {pop}%.")
    if gust:
        reasons.append(f"Wind gusts around {gust} km/h.")
    if storm:
        reasons.append("Thunderstorms are in the forecast window.")

    impact = _impact_text(role, activity, derived, inputs)
    recommendation, timing = _recommendation(role, activity, derived, parsed, missing)
    consider.extend(_consider(role, activity, derived, parsed))
    avoid.extend(_avoid(role, activity, derived))

    if missing:
        uncertainty.extend([f"Missing: {item.replace('_', ' ')}" for item in missing])

    score = 0.86
    if missing:
        score -= 0.12 * min(len(missing), 2)
    if not bundle.get("warnings"):
        score -= 0.02
    if role == "researcher":
        score = min(score + 0.04, 0.92)
    if role == "climate_analyst":
        score = 0.7
        uncertainty.append(
            "Long-term climate-change attribution is not claimed from short forecast windows; "
            "use the live historical/climate analysis tools for ERA5 multi-year statistics."
        )

    situation = (
        f"{location} — {time_range}: {bundle.get('current', {}).get('condition') or 'forecast available'}. "
        f"Role={cfg['label']}; activity={activity}."
    )

    climate_block = None
    if role == "climate_analyst":
        climate_block = {
            "available": False,
            "note": (
                "Demo station climatology was removed. Request historical analysis "
                "(ERA5 via Open-Meteo) for multi-year statistics. "
                "Do not invent climate trends."
            ),
        }

    return {
        "recommendation": recommendation,
        "confidence": _conf_label(score),
        "confidence_score": round(max(0.4, min(score, 0.95)), 2),
        "reasons": reasons,
        "uncertainty": uncertainty,
        "missing_information": missing,
        "consider": consider,
        "avoid": avoid,
        "timing": timing,
        "impact": impact,
        "situation": situation,
        "climate": climate_block,
        "response_shape": [
            "current_or_forecast_situation",
            "role_specific_impact",
            "recommended_action",
            "timing",
            "important_caveat",
        ],
    }


def _impact_text(role: str, activity: str, derived: dict[str, Any], inputs: dict[str, Any]) -> str:
    templates = {
        "farmer": (
            f"For {activity}, rain_risk={derived.get('harvest_risk') or derived.get('rain_risk')}, "
            f"lodging_risk={derived.get('lodging_risk')}, spraying_suitability={derived.get('spraying_suitability')}."
        ),
        "citizen": (
            f"Outdoor/travel impact: outdoor_activity_risk={derived.get('outdoor_activity_risk')}, "
            f"rain_risk={derived.get('rain_risk')}."
        ),
        "aviation": (
            f"Operational weather risk={derived.get('flight_weather_risk')}; "
            f"thunderstorm_risk={derived.get('thunderstorm_risk')}; "
            f"visibility_risk={derived.get('visibility_risk')}."
        ),
        "marine": (
            f"Marine conditions: wind_risk={derived.get('strong_wind_risk')}, "
            f"small_boat_risk={derived.get('small_boat_risk')}, "
            f"rough_sea_risk={derived.get('rough_sea_risk')}."
        ),
        "urban_planner": (
            f"Infrastructure: urban_flood_risk={derived.get('urban_flood_risk')}, "
            f"stormwater_pressure={derived.get('stormwater_pressure')}."
        ),
        "air_quality": (
            f"Pollution_risk={derived.get('pollution_risk')}, "
            f"dispersion={derived.get('dispersion_conditions')}."
        ),
        "researcher": "Present the numbers and method; implications are optional unless asked.",
        "climate_analyst": "Interpret against a baseline period; do not treat tomorrow as climate.",
        "flood_disaster": (
            f"Disaster-management interpretation of NWP hazards; overall derived rain_risk="
            f"{derived.get('rain_risk')}, wind_risk={derived.get('wind_risk')}. "
            "Do not treat these role indicators as a second NWP severity score."
        ),
    }
    return templates.get(role, "Weather may affect the planned activity.")


def _recommendation(
    role: str,
    activity: str,
    derived: dict[str, Any],
    parsed: dict[str, Any],
    missing: list[str],
) -> tuple[str, str | None]:
    timing = derived.get("suitable_spray_window")
    if role == "farmer" and activity == "harvesting":
        rec = (
            "If the crop is fully mature and harvesting plus covered dry storage can be finished "
            "before the forecast rain/wind window, harvesting during the remaining dry hours may "
            "reduce lodging and wetting risk. If that cannot be completed, waiting may be better "
            "than leaving a partially harvested field exposed."
        )
        if "crop_type" in missing:
            rec += " Which crop are you growing? Advice changes with crop and stage."
        return rec, parsed.get("time_range")
    if role == "farmer" and activity in {"pesticide_spraying", "fungicide_spraying"}:
        if timing and timing != "none_in_next_24h":
            rec = (
                f"A stricter spray window is {timing} if wind stays light and rain stays off. "
                "Avoid spraying when gusts or rain chance rise later in the day."
            )
        else:
            rec = (
                "No clearly suitable spray window in the next 24 hours from wind/rain thresholds. "
                "Prefer waiting rather than spraying ahead of wash-off or drift risk."
            )
        if "crop_type" in missing:
            rec += " Confirm crop before choosing product/timing."
        return rec, timing
    if role == "aviation":
        return (
            "Thunderstorms, gusts, or reduced visibility in the period can affect operations. "
            "This is decision-support only — check the latest METAR/TAF and official aviation "
            "advisories before departure. Do not treat this as clearance to fly.",
            parsed.get("time_range"),
        )
    if role == "marine":
        rec = (
            "Reassess departure timing against wind, thunderstorm, and (if available) wave conditions. "
            "Smaller craft face higher risk at the same wind speed."
        )
        if "vessel_type" in missing:
            rec += " What vessel or activity (kayak, fishing boat, cargo)?"
        return rec, parsed.get("time_range")
    if role == "air_quality":
        if "aq_measurements" in missing:
            return (
                "I could not retrieve air-quality measurements, so I will not infer AQI from weather "
                "alone. Use a local AQI source; weather (wind/rain) only hints at dispersion.",
                None,
            )
        return (
            "Use the measured/forecast pollutant levels together with wind and rain. "
            "Sensitive groups should be more cautious when pollution_risk is moderate or high.",
            parsed.get("time_range"),
        )
    if role == "researcher":
        return (
            "Report the retrieved values, units, and source. Do not convert this into farm or "
            "disaster advice unless explicitly asked.",
            None,
        )
    if role == "climate_analyst":
        return (
            "Describe the baseline period, pattern, and limitations. Do not treat tomorrow's "
            "forecast as a climate trend.",
            None,
        )
    if role == "urban_planner":
        return (
            "Focus on short-duration rainfall intensity and whether drainage can take the runoff. "
            "Site drainage capacity is unknown — treat flood conclusions as planning considerations, "
            "not mapped flood forecasts.",
            parsed.get("time_range"),
        )
    if role == "flood_disaster":
        return (
            "Use the NWP Hazard Assessment as the severity source. Describe developing hazards "
            "and practical precautions. Do not predict floods or cyclones and do not issue "
            "evacuations. Keep official warnings (if any) separate from WeatherGPT's assessment.",
            parsed.get("time_range"),
        )
    return (
        "If the activity can shift by a few hours, prefer the drier/calmer part of the forecast. "
        "If thunderstorms develop, delay outdoor exposure.",
        parsed.get("time_range"),
    )


def _consider(role: str, activity: str, derived: dict[str, Any], parsed: dict[str, Any]) -> list[str]:
    items = [
        "Verify local conditions at start time — forecasts can shift by a few hours.",
    ]
    if role == "farmer" and activity == "harvesting":
        items.append("Only proceed if produce can be moved to covered dry storage the same day.")
    if derived.get("suitable_spray_window") not in {None, "none_in_next_24h"}:
        items.append(f"Prefer the calmer window {derived.get('suitable_spray_window')}.")
    if role == "aviation":
        items.append("Cross-check METAR/TAF close to departure.")
    return items


def _avoid(role: str, activity: str, derived: dict[str, Any]) -> list[str]:
    items: list[str] = []
    if derived.get("thunderstorm_risk") == "high" or derived.get("storm_risk") == "high":
        items.append("Avoid relying on a single go/no-go from this chat during thunderstorm risk.")
    if role == "farmer" and activity in {"pesticide_spraying", "fungicide_spraying"}:
        items.append("Avoid spraying into rising wind or before expected wash-off rain.")
    if role == "farmer" and activity == "harvesting":
        items.append("Avoid leaving harvested material exposed if rain/gusts arrive before covering.")
    if role == "aviation":
        items.append("Do not interpret this reply as permission to fly.")
    return items
