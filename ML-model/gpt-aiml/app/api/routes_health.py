"""Health and model metadata endpoints."""
from datetime import datetime
from typing import Any, Dict
from fastapi import APIRouter
from app.core.config import get_settings
from app.llm.key_manager import get_key_manager
from app.ml.risk_model import RuleBasedRiskEngine

router = APIRouter(tags=["System & Health"])


@router.get("/health", summary="Service health and key status")
async def get_health() -> Dict[str, Any]:
    """Return health status, key rotation status, and service uptime."""
    settings = get_settings()
    key_mgr = get_key_manager()

    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "mock_mode": settings.MOCK_MODE,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "gemini_key_slots": key_mgr.get_status_report(),
    }


@router.get("/model-info", summary="Active AI/ML model versions and capabilities")
async def get_model_info() -> Dict[str, Any]:
    """Return active model architectures, feature pipeline, and calibration parameters."""
    settings = get_settings()
    return {
        "service": settings.APP_NAME,
        "llm_model": settings.GEMINI_MODEL,
        "risk_engine": {
            "model_version": RuleBasedRiskEngine.MODEL_VERSION,
            "architecture": "Deterministic Multi-Hazard Weighted Feature Normalization with Official Warning Isolation",
            "supported_hazards": ["heat", "heavy_rain", "thunderstorm", "high_wind", "fog_visibility", "cold_wave", "composite"],
        },
        "anomaly_engine": {
            "methodology": "Z-Score and Gaussian Percentile Ranking against 30-Year Climatological Normals",
            "supported_metrics": ["temperature", "rainfall", "humidity", "wind"],
        },
        "advisory_engine": {
            "supported_domains": ["agriculture", "travel", "disaster", "urban_general"],
            "action_priorities": "1 (Critical/Immediate) to 5 (Informational)",
        },
        "multilingual_support": ["en (English)", "hi (Hindi)"],
    }
