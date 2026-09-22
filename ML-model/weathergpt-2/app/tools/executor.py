from typing import Any, Optional

from app.models.advisory import AdvisoryDomain, AdvisoryRequest
from app.models.anomaly import AnomalyDetectRequest, AnomalyType
from app.models.climate import ClimateMetric, ClimateTrendRequest
from app.models.common import LocationQuery
from app.models.risk import HazardType, RiskScoreRequest
from app.services.advisory import generate_advisory
from app.services.anomaly import detect_anomalies
from app.services.climate import analyze_climate
from app.services.context import get_official_alerts
from app.services.location import search_location
from app.services.risk import calculate_risk
from app.services.forecast_grounding import build_grounded_forecast
from app.services.historical_analysis import parse_period, run_historical_query
from app.services.nwp_hazards import assess_nwp_hazards_for_location
from app.services.nwp_verification import verify_models
from app.services.weather import get_current_weather, get_forecast, get_historical_weather


def _location_query(args: dict[str, Any]) -> LocationQuery:
    return LocationQuery(
        name=args.get("location_name"),
        lat=args.get("latitude"),
        lon=args.get("longitude"),
    )


def execute_tool(
    name: str,
    args: dict[str, Any],
    alert_context: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Run a tool requested by the LLM and return a JSON-serializable result."""
    if name == "search_location":
        result = search_location(args["location_name"])
        if result is None:
            return {
                "error": "Location not found",
                "location_name": args["location_name"],
            }
        return result

    if name == "get_current_weather":
        return get_current_weather(args["latitude"], args["longitude"])

    if name == "get_forecast":
        days = args.get("days", 3)
        lat = args["latitude"]
        lon = args["longitude"]
        city = args.get("location_name")
        raw = get_forecast(lat, lon, days=days)
        if raw.get("error"):
            return raw
        # Attach grounded summary so the LLM cannot invent weekly trends
        pseudo_message = f"forecast next {days} days"
        if city:
            pseudo_message = f"forecast next {days} days in {city}"
        grounded = build_grounded_forecast(
            pseudo_message,
            client_lat=lat,
            client_lon=lon,
            client_name=city,
        )
        return {
            **raw,
            "grounded_summary": grounded.get("daily_table") if grounded else None,
            "trend_note": grounded.get("trend_note") if grounded else None,
            "data_source": grounded.get("primary_source") if grounded else "open_meteo",
            "imd_status": (grounded.get("imd") or {}).get("source") if grounded else None,
        }

    if name == "get_alerts":
        location_name = args.get("location_name")
        if alert_context is not None:
            return {
                "source_type": "backend_context",
                "demo": False,
                "active_alerts_count": len(alert_context),
                "data": alert_context,
            }
        alerts, source = get_official_alerts(location_name, None)
        return {
            "source_type": source,
            "demo": False,
            "available": False,
            "note": (
                "No official warning feed is configured for this request. "
                "WeatherGPT does not invent IMD alerts. Pass alert_context from the backend "
                "when a real warning source is available."
            ),
            "active_alerts_count": len(alerts),
            "data": alerts,
            "location_name": location_name,
        }

    if name == "get_risk_score":
        hazard_raw = str(args.get("hazard") or "composite")
        try:
            hazard = HazardType(hazard_raw)
        except ValueError:
            hazard = HazardType.COMPOSITE
        result = calculate_risk(
            RiskScoreRequest(
                location=_location_query(args),
                hazard=hazard,
                alert_context=alert_context,
            )
        )
        return result.model_dump()

    if name == "get_advisory":
        domain_raw = str(args.get("domain") or "urban_general")
        try:
            domain = AdvisoryDomain(domain_raw)
        except ValueError:
            domain = AdvisoryDomain.URBAN_GENERAL
        result = generate_advisory(
            AdvisoryRequest(
                location=_location_query(args),
                domain=domain,
                alert_context=alert_context,
            )
        )
        return result.model_dump()

    if name == "get_historical_weather":
        past_date = args.get("date")
        lat = args.get("latitude")
        lon = args.get("longitude")
        location_name = args.get("location_name")
        if (lat is None or lon is None) and location_name:
            found = search_location(location_name)
            if found and not found.get("error"):
                lat = found.get("latitude")
                lon = found.get("longitude")
                location_name = found.get("name") or location_name
        if past_date and lat is not None and lon is not None:
            archive = get_historical_weather(lat, lon, past_date)
            archive["location_name"] = location_name
            return archive
        if lat is not None and lon is not None:
            # Prefer structured historical analysis over inventing monthly normals.
            period = parse_period(args.get("message") or "last 5 years")
            if not period.get("available"):
                return {
                    "available": False,
                    "error": period.get("error") or "Requested historical range unavailable.",
                    "location_name": location_name,
                }
            return run_historical_query(
                args.get("message") or "last 5 years",
                latitude=float(lat),
                longitude=float(lon),
                location_name=location_name,
                include_verification=False,
            )
        return {
            "available": False,
            "error": (
                "Historical weather requires coordinates or a resolvable location name, "
                "and a date or period. Demo climatological normals are not used."
            ),
            "location_name": location_name,
        }

    if name == "get_climate_trend":
        metric_raw = str(args.get("metric") or "temperature")
        try:
            metric = ClimateMetric(metric_raw)
        except ValueError:
            metric = ClimateMetric.TEMPERATURE
        result = analyze_climate(
            ClimateTrendRequest(
                location=_location_query(args),
                metric=metric,
            )
        )
        return result.model_dump()

    if name == "detect_anomaly":
        metric_raw = args.get("metric")
        metric = None
        if metric_raw:
            try:
                metric = AnomalyType(metric_raw)
            except ValueError:
                metric = None
        result = detect_anomalies(
            AnomalyDetectRequest(
                location=_location_query(args),
                metric=metric,
            )
        )
        return result.model_dump()

    if name == "get_nwp_hazard_assessment":
        lat = args.get("latitude")
        lon = args.get("longitude")
        location_name = args.get("location_name")
        if (lat is None or lon is None) and location_name:
            found = search_location(location_name)
            if found and not found.get("error"):
                lat = found.get("latitude")
                lon = found.get("longitude")
                location_name = found.get("name") or location_name
        if lat is None or lon is None:
            return {
                "error": "Coordinates required. Do not guess a location.",
                "official_warning": False,
            }
        result = assess_nwp_hazards_for_location(
            latitude=float(lat),
            longitude=float(lon),
            location_name=location_name,
            role=args.get("role"),
        )
        return result

    if name == "get_historical_analysis":
        return run_historical_query(
            args.get("message") or "",
            latitude=args.get("latitude"),
            longitude=args.get("longitude"),
            location_name=args.get("location_name"),
            include_verification=args.get("include_verification"),
        )

    if name == "get_nwp_verification":
        lat = args.get("latitude")
        lon = args.get("longitude")
        location_name = args.get("location_name")
        if (lat is None or lon is None) and location_name:
            found = search_location(location_name)
            if found and not found.get("error"):
                lat = found.get("latitude")
                lon = found.get("longitude")
                location_name = found.get("name") or location_name
        if lat is None or lon is None:
            return {"error": "Coordinates required. Do not guess a location."}
        if args.get("start_date") and args.get("end_date"):
            start, end = args["start_date"], args["end_date"]
        else:
            period = parse_period(args.get("message") or "last 90 days")
            if not period.get("available"):
                return {"error": period.get("error")}
            start, end = period["start"], period["end"]
        return verify_models(
            float(lat), float(lon), start, end, location_name=location_name
        )

    return {"error": f"Unknown tool: {name}"}
