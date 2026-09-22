"""Step 1 — parse a chat message into a structured role request."""
from __future__ import annotations

import re
from typing import Any, Optional

from app.services.entities import extract_place_name, parse_forecast_days
from app.services.intent import classify_intent
from app.services.role_config import get_role_config
from app.services.roles import UserRole, normalize_role

CROP_PATTERN = re.compile(
    r"\b(wheat|rice|paddy|maize|corn|sugarcane|cotton|mustard|soybean|soya|"
    r"potato|tomato|onion|mango|banana|pulses|gram|millet|jowar|bajra|"
    r"vegetables?|crop)\b",
    re.I,
)
VESSEL_PATTERN = re.compile(
    r"\b(kayak|canoe|dinghy|fishing\s*boat|trawler|cargo\s*ship|tanker|"
    r"yacht|ferry|small\s*boat|recreational\s*boat|ship|boat)\b",
    re.I,
)
ACTIVITY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("harvesting", re.compile(r"\b(harvest\w*|कटाई|तोड़)\b", re.I)),
    ("pesticide_spraying", re.compile(r"\b(pesticide|insecticide|spray\w*|छिड़काव)\b", re.I)),
    ("fungicide_spraying", re.compile(r"\b(fungicide|fungal)\b", re.I)),
    ("fertilizer_application", re.compile(r"\b(fertiliz\w*|urea|manure)\b", re.I)),
    ("irrigation", re.compile(r"\b(irrigat\w*|सिंचाई)\b", re.I)),
    ("sowing", re.compile(r"\b(sow\w*|plant\w*|seeding)\b", re.I)),
    ("drying", re.compile(r"\b(dry\w*|drying)\b", re.I)),
    ("storage", re.compile(r"\b(stor\w*|godown)\b", re.I)),
    ("field_preparation", re.compile(r"\b(field\s*work|plough\w*|tillage)\b", re.I)),
    ("walking", re.compile(r"\b(walk\w*|evening\s*stroll)\b", re.I)),
    ("commute", re.compile(r"\b(commute|office|school|umbrella)\b", re.I)),
    ("outdoor_event", re.compile(r"\b(event|picnic|outdoor)\b", re.I)),
    ("travel", re.compile(r"\b(travel\w*|trip|journey)\b", re.I)),
    ("flying", re.compile(r"\b(fly\w*|flight\w*|takeoff|landing|airport)\b", re.I)),
    ("boating", re.compile(r"\b(sail\w*|boat\w*|fish\w*|marine|offshore)\b", re.I)),
    ("exercise", re.compile(r"\b(exercise|jog\w*|run\w*|outdoor\s*workout)\b", re.I)),
    ("urban_flooding", re.compile(r"\b(flood\w*|waterlog\w*|drainage|stormwater)\b", re.I)),
    ("heat_planning", re.compile(r"\b(heat\s*island|heatwave|heat\s*stress)\b", re.I)),
    ("disaster_watch", re.compile(
        r"\b(disaster\s*risk\w*|disaster\s*prepared\w*|disaster\s*management|"
        r"severe\s*weather|developing\s*hazard|weather\s*threat|"
        r"emergency\s*weather)\b",
        re.I,
    )),
    ("air_quality", re.compile(r"\b(aqi|pollution|pm2\.?5|smog)\b", re.I)),
    ("climate_trend", re.compile(r"\b(climate|decade|normal|trend|anomaly)\b", re.I)),
]

INTENT_BY_ACTIVITY = {
    "harvesting": "harvest_decision",
    "pesticide_spraying": "spray_decision",
    "fungicide_spraying": "spray_decision",
    "irrigation": "irrigation_decision",
    "sowing": "sowing_decision",
    "drying": "drying_decision",
    "storage": "storage_decision",
    "field_preparation": "field_work_decision",
    "walking": "outdoor_activity",
    "commute": "commute_planning",
    "outdoor_event": "event_planning",
    "travel": "travel_planning",
    "flying": "flight_conditions",
    "boating": "marine_conditions",
    "exercise": "outdoor_exercise",
    "urban_flooding": "urban_flood_planning",
    "heat_planning": "heat_planning",
    "disaster_watch": "disaster_risk",
    "air_quality": "aqi_query",
    "climate_trend": "climate_trend",
}


def _time_range(text: str) -> str:
    clean = (text or "").lower()
    if re.search(r"\b(right\s*now|currently|at\s+the\s+moment|अभी)\b", clean):
        return "now"
    if re.search(r"\b(tonight|this\s+evening|evening)\b", clean):
        return "tonight"
    if re.search(r"\b(tomorrow|कल)\b", clean):
        return "tomorrow"
    if re.search(r"\b(next\s+\d+\s+days?|next\s+week|7\s*days?|this\s+week)\b", clean):
        return "this_week"
    if re.search(r"\b(today|आज)\b", clean):
        return "today"
    if re.search(r"\b(last\s+week|yesterday|historical|past)\b", clean):
        return "historical"
    days = parse_forecast_days(text, default=3)
    if days >= 7:
        return "this_week"
    if days == 2:
        return "tomorrow"
    return "today"


def _activity(text: str) -> Optional[str]:
    for name, pattern in ACTIVITY_PATTERNS:
        if pattern.search(text or ""):
            return name
    return None


def _urgency(text: str, activity: Optional[str], time_range: str) -> str:
    clean = (text or "").lower()
    high_markers = bool(
        re.search(r"\b(should\s+i|heavy\s+rain|storm|urgent|immediately|ready\s+for)\b", clean)
    )
    if activity in {"harvesting", "flying", "boating"} and time_range in {"now", "today", "tomorrow"}:
        return "high" if high_markers or time_range in {"now", "tomorrow"} else "medium"
    if high_markers:
        return "high"
    if activity:
        return "medium"
    return "low"


def _intent(role: UserRole, text: str, activity: Optional[str]) -> str:
    if role == UserRole.FLOOD_DISASTER:
        coarse = classify_intent(text)
        if coarse in {"historical", "climate_trend", "anomaly_inquiry"}:
            return coarse
        return "disaster_risk"
    if activity and activity in INTENT_BY_ACTIVITY:
        mapped = INTENT_BY_ACTIVITY[activity]
        if role == UserRole.RESEARCHER and mapped not in {"climate_trend"}:
            coarse = classify_intent(text)
            if coarse in {"historical", "climate_trend"}:
                return coarse
        return mapped
    coarse = classify_intent(text)
    if coarse != "general":
        return coarse
    defaults = {
        UserRole.FARMER: "crop_protection",
        UserRole.AVIATION: "flight_conditions",
        UserRole.MARINE: "marine_conditions",
        UserRole.CLIMATE_ANALYST: "climate_trend",
        UserRole.URBAN_PLANNER: "urban_general",
        UserRole.AIR_QUALITY: "aqi_query",
        UserRole.RESEARCHER: "data_query",
        UserRole.CITIZEN: "current_weather",
        UserRole.FLOOD_DISASTER: "disaster_risk",
    }
    return defaults.get(role, "general")


def parse_user_request(
    message: str,
    role: Optional[str] = None,
    client_location_name: Optional[str] = None,
) -> dict[str, Any]:
    user_role = normalize_role(role)
    activity = _activity(message)
    time_range = _time_range(message)
    place = extract_place_name(message) or client_location_name
    crop = None
    crop_match = CROP_PATTERN.search(message or "")
    if crop_match:
        crop = crop_match.group(1).lower()
    vessel = None
    vessel_match = VESSEL_PATTERN.search(message or "")
    if vessel_match:
        vessel = vessel_match.group(1).lower()
    mature = bool(re.search(r"\b(mature|ready\s+for\s+harvest|fully\s+ripe)\b", message or "", re.I))
    entities: dict[str, Any] = {}
    if crop:
        entities["crop_type"] = crop
    if mature:
        entities["crop_stage"] = "mature"
    if vessel:
        entities["vessel_type"] = vessel

    cfg = get_role_config(user_role)
    missing = []
    for key in cfg.get("critical_missing") or []:
        if key == "crop_type" and activity in {
            "harvesting",
            "pesticide_spraying",
            "fungicide_spraying",
            "irrigation",
            "sowing",
        }:
            if "crop_type" not in entities:
                missing.append("crop_type")
        elif key == "vessel_type" and user_role == UserRole.MARINE:
            if "vessel_type" not in entities and (
                activity == "boating"
                or re.search(r"\b(should\s+i|safe|go\s+out|depart)\b", message or "", re.I)
            ):
                missing.append("vessel_type")
        elif key == "drainage_capacity" and user_role == UserRole.URBAN_PLANNER:
            missing.append("drainage_capacity")
        elif key == "aq_measurements":
            # filled later if AQ fetch fails
            pass

    return {
        "role": user_role.value,
        "intent": _intent(user_role, message, activity),
        "location": place,
        "time_range": time_range,
        "activity": activity,
        "entities": entities,
        "urgency": _urgency(message, activity, time_range),
        "forecast_days": parse_forecast_days(message, default=3 if time_range != "this_week" else 7),
        "missing_information": missing,
        "user_query": (message or "").strip(),
    }
