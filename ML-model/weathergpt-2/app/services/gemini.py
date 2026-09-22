import os
import re
import time
from datetime import date
from app.services.followups import suggest_follow_ups
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ClientError

from app.core.exceptions import GeminiUnavailableError
from app.models.advisory import AdvisoryResponse
from app.models.risk import RiskScoreResponse
from app.services.flood_disaster import (
    build_disaster_assessment,
    compact_disaster_for_ui,
    format_disaster_context_block,
)
from app.services.historical_analysis import (
    format_historical_context_block,
    run_historical_query,
)
from app.services.forecast_grounding import build_grounded_forecast, resolve_coordinates
from app.services.intent import classify_intent
from app.services.language import detect_language, language_display_name
from app.services.nwp_hazards import assess_nwp_hazards_for_location, format_nwp_context_block
from app.services.role_config import role_system_snippet
from app.services.role_pipeline import format_advisory_context_block, run_role_pipeline
from app.services.roles import UserRole, normalize_role, role_advisory_domain
from app.tools.definitions import get_gemini_tools
from app.tools.executor import execute_tool

project_root = Path(__file__).resolve().parents[2]
load_dotenv(project_root / ".env", override=True)

_client: Optional[genai.Client] = None


def _get_model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


def _get_client() -> genai.Client:
    global _client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiUnavailableError(
            "GEMINI_API_KEY is missing. Create a .env file and set GEMINI_API_KEY."
        )
    if _client is None:
        _client = genai.Client(api_key=api_key)
    return _client


SYSTEM_PROMPT = """
You are WeatherGPT, a helpful weather assistant for a MERN weather app.

Rules:
1. NEVER invent weather facts, AQI, waves, or warnings. Use ONLY the STRUCTURED ADVISORY
   CONTEXT and any VERIFIED FORECAST DATA blocks. If you see WEATHER DATA UNAVAILABLE,
   say you could not fetch the required data. Do not guess numbers or give advice anyway.
2. Language: reply entirely in the detected user language (English or any supported Indian
   language: Hindi, Bengali, Telugu, Marathi, Tamil, Urdu, Gujarati, Kannada, Malayalam,
   Punjabi, Odia). If the user mixed languages, reply entirely in whichever language
   covers ~70%+ of the prompt (or the largest share if none reach 70%).
3. Pipeline (already run before you reply): parse request → select variables → fetch weather
   → derive role indicators → advisory engine. You explain that evidence; you do not redo
   the science from a raw API dump.
4. Universal pattern for every role: Weather fact → Impact → Action.
5. Response shape (where applicable):
   Situation → Role-specific impact → Recommended action → Timing → Important caveat.
6. Tools are fallback only if the structured context is missing a named place. Do not
   override structured numbers with tool chatter or invented alerts.
7. Location: if coordinates or a city are present, NEVER ask which location.
8. Advisory discipline:
   - No unconditional yes/no when missing facts (crop, vessel, airport ops, health, drainage).
   - Prefer "If … then …; otherwise …".
   - Use rain amount, wind/gusts, and timing — not probability alone.
   - Ask at most one clarifying question when missingInformation is set.
   - Aviation: never "safe to fly". Marine: never "safe for all boats".
   - Researcher: data first, not operational advice, unless asked.
   - Climate analyst: do not confuse tomorrow's weather with climate.
   - Air quality: do not infer AQI from rain/wind alone.
9. Stay concise (about 4–7 sentences for decisions). Researcher may include more numbers.
10. Clarifying questions inside the reply must use the same language/script as the user.
11. If an NWP HAZARD ASSESSMENT block is present, treat it as the only source for
    GFS/ECMWF numbers, severity, and model agreement. Do not invent values, do not
    change severity, do not call it an official IMD warning, and do not claim a flood
    or cyclone will occur. Explain Weather fact → Impact → Action using the role.
12. Flood & Disaster role: lead with a disaster-management assessment (situation, developing
    hazards, severity, forecast window, model agreement, advisory, official warning status).
    Keep Official warning separate from WeatherGPT NWP assessment. Never merge them.
    Never claim a flood or cyclone will occur. Never invent an official warning.
13. If a HISTORICAL / CLIMATE ANALYSIS block is present, use only those ERA5/reanalysis
    numbers. Do not invent totals, extremes, or MAE. Do not call a few months a climate
    trend. NWP verification skill is for that location and period only.
""".strip()


def ask_gemini(prompt: str) -> str:
    client = _get_client()
    response = client.models.generate_content(
        model=_get_model_name(),
        contents=prompt,
        config=types.GenerateContentConfig(
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        ),
    )
    return response.text


def _build_user_payload(
    message: str,
    location: Optional[dict[str, Any]] = None,
    language: str = "en",
    role: Optional[str] = None,
    forecast_grounding: Optional[dict[str, Any]] = None,
    pipeline: Optional[dict[str, Any]] = None,
    nwp_assessment: Optional[dict[str, Any]] = None,
    disaster_assessment: Optional[dict[str, Any]] = None,
    historical_analysis: Optional[dict[str, Any]] = None,
) -> str:
    language_name = language_display_name(language)
    user_role = normalize_role(role)
    parts = [
        message.strip(),
        "",
        f"[Current date: {date.today().isoformat()}]",
        f"[Detected language: {language} ({language_name})]",
        (
            f"[Respond entirely in {language_name}. Do not mix English unless the "
            f"detected language is English. Use the native script for {language_name}.]"
        ),
        f"[ROLE PERSONA: {user_role.value}]",
        role_system_snippet(user_role),
    ]

    if location is not None:
        name_part = f", place hint: {location['name']}" if location.get("name") else ""
        parts.append(
            f"[Client GPS coordinates (USE THESE if no other city named): "
            f"lat={location['lat']}, lon={location['lon']}{name_part}]"
        )
        parts.append(
            "[Do NOT ask the user for location — coordinates are already available.]"
        )

    if pipeline is not None:
        parts.extend(["", format_advisory_context_block(pipeline)])

    if nwp_assessment is not None:
        loc_name = None
        if nwp_assessment.get("location"):
            loc_name = nwp_assessment["location"].get("name")
        parts.extend(["", format_nwp_context_block(nwp_assessment, loc_name)])

    if disaster_assessment is not None:
        parts.extend(["", format_disaster_context_block(disaster_assessment)])

    if historical_analysis is not None:
        parts.extend(["", format_historical_context_block(historical_analysis)])

    if forecast_grounding and not forecast_grounding.get("error"):
        parts.extend(
            [
                "",
                "[VERIFIED MULTI-DAY FORECAST TABLE — do not contradict structured context:]",
                f"Source: {forecast_grounding.get('primary_source')}",
                f"Location: {forecast_grounding.get('location', {}).get('name')}",
                "Daily:",
                *forecast_grounding.get("daily_table", []),
                forecast_grounding.get("trend_note", ""),
                forecast_grounding.get("grounding_rules", ""),
            ]
        )

    return "\n".join(parts)


def _plain_tts(text: str) -> str:
    return (
        text.replace("°C", " degrees Celsius")
        .replace("mm", " millimeters")
        .replace("⚠️", "Warning:")
        .replace("*", "")
        .replace("#", "")
    )


def _estimate_confidence(
    tool_calls: list[str],
    intent: str,
    last_advisory: Optional[AdvisoryResponse],
    has_forecast_grounding: bool,
) -> float:
    if not tool_calls and not has_forecast_grounding:
        return 0.72
    confidence = 0.90 + min(len(tool_calls), 3) * 0.02
    if has_forecast_grounding:
        confidence = max(confidence, 0.95)
    if intent == "advisory_request" and last_advisory:
        confidence = max(confidence, 0.96)
    if "get_forecast" in tool_calls or "get_advisory" in tool_calls:
        confidence = max(confidence, 0.94)
    return round(min(confidence, 0.98), 2)


def _extract_location_name(
    tool_calls_log: list[tuple[str, dict[str, Any]]],
    resolved_name: Optional[str],
) -> Optional[str]:
    if resolved_name:
        return resolved_name
    for _, args in reversed(tool_calls_log):
        if args.get("location_name"):
            return str(args["location_name"])
    return None


def chat_with_tools(
    message: str,
    location: Optional[dict[str, Any]] = None,
    alert_context: Optional[list[dict[str, Any]]] = None,
    role: Optional[str] = None,
    max_tool_rounds: int = 8,
) -> dict[str, Any]:
    start_time = time.time()
    language = detect_language(message)
    intent = classify_intent(message)
    user_role = normalize_role(role)
    if intent == "disaster_risk" and user_role == UserRole.CITIZEN:
        user_role = UserRole.FLOOD_DISASTER
        role = UserRole.FLOOD_DISASTER.value

    client_lat = location.get("lat") if location else None
    client_lon = location.get("lon") if location else None
    client_name = location.get("name") if location else None

    resolved = resolve_coordinates(message, client_lat, client_lon, client_name)
    pipeline = run_role_pipeline(
        message,
        role=role,
        client_lat=client_lat,
        client_lon=client_lon,
        client_name=client_name,
        alert_context=alert_context,
    )
    parsed = pipeline.get("parsed") or {}
    if parsed.get("intent"):
        intent = parsed["intent"]

    forecast_grounding = None
    if intent in {"forecast", "this_week"} or parsed.get("time_range") == "this_week":
        forecast_grounding = build_grounded_forecast(
            message, client_lat, client_lon, client_name
        )

    nwp_assessment = None
    nwp_intents = {
        "nwp_hazard",
        "alert_inquiry",
        "risk_assessment",
        "urban_flood_planning",
        "disaster_risk",
    }
    wants_nwp = (
        user_role == UserRole.FLOOD_DISASTER
        or intent in nwp_intents
        or bool(
            re.search(
                r"\b(heavy\s+rain|strong\s+wind|gust|thunderstorm|early\s+warning|"
                r"hazard|gfs|ecmwf|nwp)\b",
                message,
                re.I,
            )
        )
    )
    if wants_nwp and resolved.get("lat") is not None and resolved.get("lon") is not None:
        nwp_assessment = assess_nwp_hazards_for_location(
            latitude=float(resolved["lat"]),
            longitude=float(resolved["lon"]),
            location_name=resolved.get("name"),
            role=user_role.value,
        )
    elif wants_nwp:
        nwp_assessment = {
            "error": "Location not resolved. Do not guess NWP values.",
            "official_warning": False,
            "available": False,
        }

    disaster_assessment = None
    if user_role == UserRole.FLOOD_DISASTER:
        disaster_assessment = build_disaster_assessment(
            nwp_assessment
            or {
                "available": False,
                "error": "Location not resolved. Do not guess a location or NWP values.",
            },
            official_warnings=alert_context,
            location_name=resolved.get("name") if resolved else None,
            latitude=resolved.get("lat") if resolved else None,
            longitude=resolved.get("lon") if resolved else None,
        )

    historical_analysis = None
    hist_intents = {
        "historical",
        "historical_compare",
        "nwp_verification",
        "climate_trend",
    }
    wants_hist = intent in hist_intents or bool(
        re.search(
            r"\b(last\s+\d+\s+years?|compared\s+with|unusually|how\s+often|"
            r"highest\s+rainfall|how\s+accurate|over\s+the\s+last)\b",
            message,
            re.I,
        )
    )
    if wants_hist:
        historical_analysis = run_historical_query(
            message,
            latitude=resolved.get("lat") if resolved else None,
            longitude=resolved.get("lon") if resolved else None,
            location_name=resolved.get("name") if resolved else None,
            include_verification=(intent == "nwp_verification") or None,
        )

    user_text = _build_user_payload(
        message,
        location=location,
        language=language,
        role=role,
        forecast_grounding=forecast_grounding,
        pipeline=pipeline,
        nwp_assessment=nwp_assessment,
        disaster_assessment=disaster_assessment,
        historical_analysis=historical_analysis,
    )

    decision_intents = {
        "advisory_request",
        "harvest_decision",
        "spray_decision",
        "irrigation_decision",
        "sowing_decision",
        "outdoor_activity",
        "event_planning",
        "commute_planning",
        "flight_conditions",
        "marine_conditions",
        "urban_flood_planning",
        "aqi_query",
        "disaster_risk",
    }
    if intent in decision_intents:
        user_text += (
            "\n[User wants practical advice. Use advisory discipline: Weather fact → Impact → Action. "
            "Conditional recommendation, assumptions, local verify, safer alternative.]"
        )
        user_text += f"\n[Preferred advisory domain for tools: {role_advisory_domain(user_role)}]"

    tool_calls: list[str] = []
    tool_calls_log: list[tuple[str, dict[str, Any]]] = []
    last_risk: Optional[RiskScoreResponse] = None
    last_advisory: Optional[AdvisoryResponse] = None

    try:
        client = _get_client()
        chat = client.chats.create(
            model=_get_model_name(),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=get_gemini_tools(),
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )

        response = chat.send_message(user_text)

        for _ in range(max_tool_rounds):
            function_calls = response.function_calls
            if not function_calls:
                break

            function_response_parts: list[types.Part] = []
            for fc in function_calls:
                fc_args = dict(fc.args)
                # Skip alert lookup on pure forecast unless user asked about warnings
                if fc.name == "get_alerts" and intent == "forecast":
                    if not re.search(r"alert|warning|चेतावनी|अलर्ट", message, re.I):
                        result = {
                            "skipped": True,
                            "reason": (
                                "Forecast question — use the verified daily forecast table. "
                                "Official alerts are only used when requested or supplied as alert_context."
                            ),
                        }
                        tool_calls.append(f"{fc.name}(skipped)")
                        function_response_parts.append(
                            types.Part.from_function_response(
                                name=fc.name, response={"result": result}
                            )
                        )
                        continue

                if (
                    fc.name == "get_alerts"
                    and isinstance(nwp_assessment, dict)
                    and nwp_assessment.get("available")
                    and not re.search(r"imd|official", message, re.I)
                ):
                    result = {
                        "skipped": True,
                        "reason": (
                            "NWP hazard assessment already provided. "
                            "Do not invent official IMD alerts; use alert_context only when present."
                        ),
                        "official_warning": False,
                    }
                    tool_calls.append(f"{fc.name}(skipped)")
                    function_response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name, response={"result": result}
                        )
                    )
                    continue

                print(f"[tool call] {fc.name}({fc_args})")
                tool_calls.append(fc.name)
                tool_calls_log.append((fc.name, fc_args))

                if fc.name == "get_advisory" and "domain" not in fc_args:
                    fc_args["domain"] = role_advisory_domain(user_role)

                result = execute_tool(fc.name, fc_args, alert_context=alert_context)

                if fc.name == "get_risk_score" and "score" in result:
                    try:
                        last_risk = RiskScoreResponse.model_validate(result)
                    except Exception:
                        last_risk = None
                if fc.name == "get_advisory" and "recommendations" in result:
                    try:
                        last_advisory = AdvisoryResponse.model_validate(result)
                    except Exception:
                        last_advisory = None

                function_response_parts.append(
                    types.Part.from_function_response(
                        name=fc.name,
                        response={"result": result},
                    )
                )

            response = chat.send_message(function_response_parts)

        reply = response.text or (
            "I could not generate a weather response right now. Please try again."
        )
        latency_ms = int((time.time() - start_time) * 1000)
        location_name = _extract_location_name(
            tool_calls_log, resolved.get("name") if resolved else None
        )
        follow_ups = suggest_follow_ups(intent, language, location_name, role=role)
        missing = ((pipeline.get("advisory_context") or {}).get("missingInformation")) or (
            parsed.get("missing_information") or []
        )
        if "crop_type" in missing:
            follow_ups = [
                missing_info_follow_up("crop_type", language, location_name)
            ] + follow_ups[:2]
        if "vessel_type" in missing:
            follow_ups = [
                missing_info_follow_up("vessel_type", language, location_name)
            ] + follow_ups[:2]
        confidence = pipeline.get("confidence_score") or _estimate_confidence(
            tool_calls, intent, last_advisory, bool(forecast_grounding)
        )
        if not pipeline.get("available"):
            confidence = min(float(confidence), 0.45)

        return {
            "response": reply,
            "language": language,
            "intent": intent,
            "role": user_role.value,
            "tool_calls": tool_calls,
            "risk": last_risk,
            "advisory": last_advisory,
            "follow_up_questions": follow_ups,
            "confidence": confidence,
            "latency_ms": latency_ms,
            "tts_hint": _plain_tts(reply),
            "forecast_grounding": forecast_grounding,
            "parsed_request": parsed,
            "advisory_context": pipeline.get("advisory_context"),
            "disaster_assessment": (
                compact_disaster_for_ui(disaster_assessment)
                if disaster_assessment
                else None
            ),
            "historical_analysis": historical_analysis,
        }

    except ClientError as exc:
        print(f"[gemini error] code={exc.code} status={exc.status} message={exc.message}")
        if exc.code == 429:
            raise GeminiUnavailableError(
                "The weather AI is temporarily rate-limited. Please wait about a minute and try again."
            ) from exc
        raise GeminiUnavailableError() from exc
