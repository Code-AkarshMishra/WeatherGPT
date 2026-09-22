"""Risk evaluation service."""
from typing import Any, Dict, List, Optional
from app.ml.risk_model import RuleBasedRiskEngine
from app.schemas.common import GeoLocation
from app.schemas.risk import HazardType, RiskScoreRequest, RiskScoreResponse
from app.tools.alerts import AlertsTool
from app.tools.forecast import ForecastTool
from app.tools.weather import CurrentWeatherTool


class RiskService:
    """Service handling multi-hazard risk computations and explanations."""

    def __init__(self):
        self.weather_tool = CurrentWeatherTool()
        self.forecast_tool = ForecastTool()
        self.alerts_tool = AlertsTool()

    async def calculate_risk(self, request: RiskScoreRequest) -> RiskScoreResponse:
        """Evaluate risk using supplied context or retrieved station data."""
        weather_ctx = request.weather_context
        forecast_ctx = request.forecast_context
        alert_ctx = request.alert_context

        # Fetch missing context if needed
        if not weather_ctx:
            w_res = await self.weather_tool.execute(location=request.location)
            weather_ctx = w_res.get("data", {})

        if forecast_ctx is None:
            f_res = await self.forecast_tool.execute(location=request.location)
            forecast_ctx = f_res.get("data", [])

        if alert_ctx is None:
            a_res = await self.alerts_tool.execute(location=request.location)
            alert_ctx = a_res.get("data", [])

        return RuleBasedRiskEngine.evaluate(
            hazard=request.hazard,
            weather=weather_ctx,
            forecast=forecast_ctx,
            alerts=alert_ctx,
        )

    async def explain_risk(self, risk_response: RiskScoreResponse) -> Dict[str, Any]:
        """Generate human-understandable explanation breakdown."""
        factors_breakdown = [
            f"• {f.feature.replace('_', ' ').title()}: Observed {f.observed_value} ({f.impact.upper()} impact - {f.threshold})"
            for f in risk_response.factors
        ]

        warning_status = "ACTIVE OFFICIAL WARNING" if risk_response.official_warning else "No official alerts"

        return {
            "hazard": risk_response.hazard.value,
            "overall_score": f"{risk_response.score}/100 ({risk_response.level.value})",
            "official_status": warning_status,
            "top_drivers": factors_breakdown,
            "narrative": risk_response.explanation,
            "model_version": risk_response.model_version,
            "confidence": f"{int(risk_response.confidence * 100)}%",
        }
