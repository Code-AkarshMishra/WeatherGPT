"""Multi-hazard risk scoring service."""
from typing import Any

from app.ml.risk_model import RuleBasedRiskEngine
from app.models.risk import RiskScoreRequest, RiskScoreResponse
from app.services.context import build_weather_context


def calculate_risk(request: RiskScoreRequest) -> RiskScoreResponse:
    ctx = build_weather_context(
        location=request.location,
        weather_override=request.weather_context,
        forecast_override=request.forecast_context,
        alert_override=request.alert_context,
    )
    return RuleBasedRiskEngine.evaluate(
        hazard=request.hazard,
        weather=ctx["weather"],
        forecast=ctx["forecast"],
        alerts=ctx["alerts"],
        source_notes=ctx["source_notes"],
    )


def explain_risk(risk: RiskScoreResponse) -> dict[str, Any]:
    factors = [
        (
            f"• {item.feature.replace('_', ' ').title()}: observed {item.observed_value} "
            f"({item.impact.upper()} impact - {item.threshold})"
        )
        for item in risk.factors
    ]
    return {
        "hazard": risk.hazard.value,
        "overall_score": f"{risk.score}/100 ({risk.level.value})",
        "official_status": (
            "Official warning in supplied alert_context"
            if risk.official_warning
            else "No matching official alerts in request"
        ),
        "top_drivers": factors,
        "narrative": risk.explanation,
        "model_version": risk.model_version,
        "confidence": f"{int(risk.confidence * 100)}%",
        "source_notes": risk.source_notes,
        "input_variables": risk.input_variables,
        "feature_weights": risk.feature_weights,
    }
