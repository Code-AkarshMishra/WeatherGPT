"""Dedicated intelligence endpoints for the MERN backend (widgets, dashboards)."""
from typing import Any

from fastapi import APIRouter

from app.ml.risk_model import RuleBasedRiskEngine
from app.models.advisory import AdvisoryRequest, AdvisoryResponse
from app.models.anomaly import AnomalyDetectRequest, AnomalyDetectResponse
from app.models.climate import ClimateTrendRequest, ClimateTrendResponse
from app.models.risk import RiskScoreRequest, RiskScoreResponse
from app.services.advisory import generate_advisory
from app.services.anomaly import detect_anomalies
from app.services.climate import analyze_climate
from app.services.risk import calculate_risk, explain_risk

router = APIRouter()


@router.post("/risk/score", response_model=RiskScoreResponse)
def risk_score(request: RiskScoreRequest) -> RiskScoreResponse:
    return calculate_risk(request)


@router.post("/risk/explain")
def risk_explain(request: RiskScoreRequest) -> dict[str, Any]:
    return explain_risk(calculate_risk(request))


@router.post("/advisory", response_model=AdvisoryResponse)
def advisory(request: AdvisoryRequest) -> AdvisoryResponse:
    return generate_advisory(request)


@router.post("/anomaly/detect", response_model=AnomalyDetectResponse)
def anomaly_detect(request: AnomalyDetectRequest) -> AnomalyDetectResponse:
    return detect_anomalies(request)


@router.post("/climate/analyze", response_model=ClimateTrendResponse)
def climate_analyze(request: ClimateTrendRequest) -> ClimateTrendResponse:
    return analyze_climate(request)


@router.get("/model-info")
def model_info() -> dict[str, Any]:
    return {
        "service": "weathergpt-ai",
        "chat": "POST /chat",
        "risk_engine": {
            "model_version": RuleBasedRiskEngine.MODEL_VERSION,
            "endpoint": "POST /risk/score",
            "supported_hazards": [item.value for item in RuleBasedRiskEngine.HAZARD_WEIGHTS],
        },
        "advisory_engine": {
            "endpoint": "POST /advisory",
            "supported_domains": ["agriculture", "travel", "disaster", "urban_general"],
        },
        "anomaly_engine": {
            "endpoint": "POST /anomaly/detect",
            "methodology": "Z-score vs ERA5 same-month reanalysis statistics (live archive)",
        },
        "climate_engine": {
            "endpoint": "POST /climate/analyze",
            "note": "Multi-year ERA5 statistics via Open-Meteo archive; no fabricated climate normals",
        },
        "historical_analysis_engine": {
            "endpoint": "POST /climate/historical-analysis",
            "source": "Open-Meteo Historical Weather API (ERA5 reanalysis)",
            "nwp_verification": "POST /climate/nwp-verification (Previous Runs API, GFS + ECMWF)",
            "note": (
                "Live archive statistics, multi-city comparison, extremes, and 24h-lead "
                "forecast verification. Not official warnings. Not a climate-change attribution."
            ),
        },
        "nwp_hazard_engine": {
            "endpoint": "POST /nwp/hazard-assessment",
            "models": ["GFS", "ECMWF IFS"],
            "access_layer": "Open-Meteo GFS and ECMWF APIs",
            "note": (
                "Rules-based screening of NWP forecasts. Not official IMD warnings. "
                "Does not predict floods or cyclones."
            ),
        },
        "multilingual_support": [
            "en",
            "hi",
            "bn",
            "te",
            "mr",
            "ta",
            "ur",
            "gu",
            "kn",
            "ml",
            "pa",
            "or",
        ],
        "roles": [
            "citizen",
            "farmer",
            "researcher",
            "aviation",
            "marine",
            "climate_analyst",
            "urban_planner",
            "air_quality",
            "flood_disaster",
        ],
        "mern_contract": {
            "required_chat_fields": ["response", "language", "status"],
            "optional_request_fields": ["location", "role", "alert_context"],
            "optional_chat_fields": [
                "intent",
                "role",
                "tool_calls",
                "risk",
                "advisory",
                "follow_up_questions",
                "confidence",
                "latency_ms",
                "tts_hint",
                "disaster_assessment",
                "historical_analysis",
            ],
        },
    }
