"""Orchestrate parse → variables → weather → indicators → advisory for every role."""
from __future__ import annotations

import json
from typing import Any, Optional

from app.services.forecast_grounding import resolve_coordinates
from app.services.indicators import compute_indicators
from app.services.request_parser import parse_user_request
from app.services.role_advisory import build_advisory
from app.services.role_config import get_role_config, role_system_snippet
from app.services.roles import normalize_role
from app.services.weather_bundle import fetch_normalized_weather, required_variables


def run_role_pipeline(
    message: str,
    role: Optional[str] = None,
    client_lat: Optional[float] = None,
    client_lon: Optional[float] = None,
    client_name: Optional[str] = None,
    alert_context: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    user_role = normalize_role(role)
    parsed = parse_user_request(message, role=user_role.value, client_location_name=client_name)
    cfg = get_role_config(user_role)
    flags = required_variables(user_role.value, parsed.get("activity"))
    resolved = resolve_coordinates(message, client_lat, client_lon, client_name)

    if resolved.get("lat") is None or resolved.get("lon") is None:
        return {
            "available": False,
            "reason": "location_unresolved",
            "parsed": parsed,
            "role_config": {
                "label": cfg["label"],
                "priorities": cfg["priorities"],
                "variables": cfg["variables"],
            },
            "system_snippet": role_system_snippet(user_role),
            "advisory_context": None,
            "error": "Unable to resolve location. Ask for a place or use device GPS.",
        }

    days = parsed.get("forecast_days") or 3
    if parsed.get("time_range") == "this_week":
        days = 7
    elif parsed.get("time_range") in {"tomorrow", "tonight"}:
        days = max(days, 2)

    bundle = fetch_normalized_weather(
        latitude=resolved["lat"],
        longitude=resolved["lon"],
        days=days,
        flags=flags,
        role=user_role.value,
        location_name=resolved.get("name") or parsed.get("location"),
    )
    if not bundle.get("available"):
        return {
            "available": False,
            "reason": "weather_unavailable",
            "parsed": parsed,
            "role_config": {"label": cfg["label"], "priorities": cfg["priorities"]},
            "system_snippet": role_system_snippet(user_role),
            "advisory_context": None,
            "error": bundle.get("error") or "Unable to fetch required weather data.",
        }

    if alert_context:
        bundle.setdefault("warnings", []).extend(alert_context)

    derived = compute_indicators(user_role.value, bundle, parsed)
    advisory = build_advisory(parsed, bundle, derived)
    weather_summary = {
        "precipitation_probability": derived.get("_inputs", {}).get("precipitation_probability"),
        "precipitation_mm": derived.get("_inputs", {}).get("precipitation_mm"),
        "wind_speed_kmh": derived.get("_inputs", {}).get("wind_speed_kmh"),
        "wind_gust_kmh": derived.get("_inputs", {}).get("wind_gust_kmh"),
        "thunderstorm": derived.get("_inputs", {}).get("thunderstorm"),
        "temp_max_c": derived.get("_inputs", {}).get("temp_max_c"),
        "humidity_percent": derived.get("_inputs", {}).get("humidity_percent"),
        "condition": (bundle.get("current") or {}).get("condition"),
    }
    extras = bundle.get("extras") or {}
    if extras.get("air_quality"):
        weather_summary["air_quality"] = extras["air_quality"]
    if extras.get("marine") and extras["marine"].get("available"):
        marine_hourly = extras["marine"].get("hourly") or []
        weather_summary["sample_wave_height_m"] = (
            marine_hourly[0].get("wave_height_m") if marine_hourly else None
        )

    public_derived = {k: v for k, v in derived.items() if not str(k).startswith("_")}
    advisory_context = {
        "role": user_role.value,
        "userQuery": parsed.get("user_query"),
        "location": bundle.get("location"),
        "timeRange": parsed.get("time_range"),
        "activity": parsed.get("activity"),
        "entities": parsed.get("entities") or {},
        "urgency": parsed.get("urgency"),
        "intent": parsed.get("intent"),
        "weather": weather_summary,
        "derivedRisks": public_derived,
        "warnings": bundle.get("warnings") or [],
        "missingInformation": advisory.get("missing_information") or [],
        "advisory": {
            "recommendation": advisory.get("recommendation"),
            "confidence": advisory.get("confidence"),
            "reasons": advisory.get("reasons"),
            "uncertainty": advisory.get("uncertainty"),
            "consider": advisory.get("consider"),
            "avoid": advisory.get("avoid"),
            "timing": advisory.get("timing"),
            "impact": advisory.get("impact"),
            "situation": advisory.get("situation"),
        },
        "climate": advisory.get("climate"),
        "source": bundle.get("source"),
        "daily": (bundle.get("forecast") or {}).get("daily") or [],
        "hourly_sample": ((bundle.get("forecast") or {}).get("hourly") or [])[:12],
    }

    return {
        "available": True,
        "parsed": parsed,
        "role_config": {
            "label": cfg["label"],
            "priorities": cfg["priorities"],
            "variables": list(flags.keys()),
        },
        "system_snippet": role_system_snippet(user_role),
        "advisory_context": advisory_context,
        "confidence_score": advisory.get("confidence_score"),
        "bundle": bundle,
    }


def format_advisory_context_block(pipeline: dict[str, Any]) -> str:
    """Plain text block injected into Gemini. No invention if data is missing."""
    if not pipeline.get("available"):
        reason = pipeline.get("error") or "Required weather data is unavailable."
        return (
            "[WEATHER DATA UNAVAILABLE]\n"
            f"{reason}\n"
            "Tell the user you are unable to fetch the required weather data. "
            "Do NOT invent temperatures, rain amounts, wind, AQI, or advice."
        )

    ctx = pipeline["advisory_context"]
    compact = {
        "role": ctx.get("role"),
        "intent": ctx.get("intent"),
        "location": ctx.get("location"),
        "timeRange": ctx.get("timeRange"),
        "activity": ctx.get("activity"),
        "entities": ctx.get("entities"),
        "urgency": ctx.get("urgency"),
        "weather": ctx.get("weather"),
        "derivedRisks": ctx.get("derivedRisks"),
        "warnings": ctx.get("warnings"),
        "missingInformation": ctx.get("missingInformation"),
        "advisory": ctx.get("advisory"),
        "climate": ctx.get("climate"),
        "source": ctx.get("source"),
        "daily": ctx.get("daily"),
    }
    return (
        "[STRUCTURED ADVISORY CONTEXT — this is the only weather evidence]\n"
        "Write: Situation → Role-specific impact → Recommended action → Timing → Caveat.\n"
        "Use Weather fact → Impact → Action. Do not invent numbers not present here.\n"
        "If missingInformation is non-empty, ask at most one clarifying question and keep advice conditional.\n"
        + json.dumps(compact, ensure_ascii=False, default=str)
    )
