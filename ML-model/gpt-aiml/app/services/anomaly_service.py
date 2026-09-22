"""Anomaly detection service — live weather + archive only; no mock normals."""
from typing import Any, Dict, Optional
from app.ml.anomaly import AnomalyEngine
from app.schemas.anomaly import AnomalyDetectRequest, AnomalyDetectResponse
from app.tools.historical import HistoricalWeatherTool
from app.tools.weather import CurrentWeatherTool


class AnomalyService:
    """Service detecting short-term departures from historical archive averages."""

    def __init__(self):
        self.weather_tool = CurrentWeatherTool()
        self.historical_tool = HistoricalWeatherTool()

    async def detect_anomalies(self, request: AnomalyDetectRequest) -> AnomalyDetectResponse:
        """Run statistical anomaly detection when live observations and archive exist."""
        if request.observed_values:
            weather_data = request.observed_values
            location_name = request.location.name if request.location else "Specified Observation"
        else:
            w_res = await self.weather_tool.execute(location=request.location)
            if w_res.get("status") != "success" or not w_res.get("data"):
                return AnomalyDetectResponse(
                    location_name=(request.location.name if request.location else "Unknown"),
                    month_analyzed="unavailable",
                    baseline_period="unavailable",
                    anomalies_detected=0,
                    results=[],
                    interpretation=(
                        w_res.get("error")
                        or "Current weather unavailable. Anomaly analysis was not run."
                    ),
                )
            weather_data = w_res.get("data", {})
            location_name = w_res.get("location", {}).get("name", "Target Station")

        # Historical normals require a past date archive call in this stack.
        # Without it, refuse rather than invent mock_baselines normals.
        h_res = await self.historical_tool.execute(location=request.location)
        historical_baseline = h_res.get("data") if h_res.get("status") == "success" else {}
        if not historical_baseline:
            return AnomalyDetectResponse(
                location_name=location_name,
                month_analyzed="unavailable",
                baseline_period="unavailable",
                anomalies_detected=0,
                results=[],
                interpretation=(
                    h_res.get("error")
                    or "Historical baseline unavailable. Mock climatological normals are not used."
                ),
            )

        month_idx = request.month or 9
        return AnomalyEngine.analyze_anomalies(
            location_name=location_name,
            observed_weather=weather_data,
            historical_baseline=historical_baseline,
            month_idx=month_idx,
            target_metric=request.metric,
        )
