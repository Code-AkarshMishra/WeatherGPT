"""Risk calculation tool wrapper."""
from typing import Any, Dict, List, Optional
from app.ml.risk_model import RuleBasedRiskEngine
from app.schemas.common import GeoLocation
from app.schemas.risk import HazardType, RiskScoreResponse
from app.tools.base import BaseWeatherTool


class RiskScoreTool(BaseWeatherTool):
    """Computes risk score from supplied or live weather — never from mock JSON."""

    def __init__(self):
        super().__init__(
            name="get_risk_score",
            description="Calculate deterministic risk score (0-100), severity level, and contributing factors."
        )

    async def execute(
        self,
        hazard: HazardType = HazardType.COMPOSITE,
        location: Optional[GeoLocation] = None,
        weather_context: Optional[Dict[str, Any]] = None,
        forecast_context: Optional[List[Dict[str, Any]]] = None,
        alert_context: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        if not weather_context:
            return self.unavailable(
                reason=(
                    "Risk scoring requires live weather_context (or upstream live weather). "
                    "Mock station current/forecast/alerts are not used as a silent fallback."
                ),
                location=location,
                hazard=getattr(hazard, "value", str(hazard)),
            )

        risk_res: RiskScoreResponse = RuleBasedRiskEngine.evaluate(
            hazard=hazard,
            weather=weather_context,
            forecast=forecast_context or [],
            alerts=alert_context or [],
        )

        return {
            "status": "success",
            "risk_evaluation": risk_res.model_dump(),
        }
