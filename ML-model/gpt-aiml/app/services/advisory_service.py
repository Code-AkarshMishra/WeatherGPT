"""Domain Advisory Engine for Agriculture, Travel, Disaster, and Urban Decision Support."""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from app.ml.features import FeatureExtractor
from app.schemas.advisory import (
    ActionRecommendation,
    AdvisoryDomain,
    AdvisoryRequest,
    AdvisoryResponse,
)
from app.schemas.risk import RiskLevel
from app.tools.alerts import AlertsTool
from app.tools.forecast import ForecastTool
from app.tools.weather import CurrentWeatherTool


class AdvisoryService:
    """Domain advisory service synthesizing structured meteorological guidance."""

    def __init__(self):
        self.weather_tool = CurrentWeatherTool()
        self.forecast_tool = ForecastTool()
        self.alerts_tool = AlertsTool()

    async def generate_advisory(self, request: AdvisoryRequest) -> AdvisoryResponse:
        """Generate domain-specific advisory based on weather and alerts."""
        weather_ctx = request.weather_context
        forecast_ctx = request.forecast_context
        alert_ctx = request.alert_context

        if not weather_ctx:
            w_res = await self.weather_tool.execute(location=request.location)
            weather_ctx = w_res.get("data", {})

        if forecast_ctx is None:
            f_res = await self.forecast_tool.execute(location=request.location)
            forecast_ctx = f_res.get("data", [])

        if alert_ctx is None:
            a_res = await self.alerts_tool.execute(location=request.location)
            alert_ctx = a_res.get("data", [])

        features, _ = FeatureExtractor.extract_features(weather_ctx, forecast_ctx, alert_ctx)

        now = datetime.utcnow()
        valid_until = (now + timedelta(hours=24)).isoformat() + "Z"

        if request.domain == AdvisoryDomain.AGRICULTURE:
            return self._build_agriculture_advisory(features, alert_ctx, valid_until)
        elif request.domain == AdvisoryDomain.TRAVEL:
            return self._build_travel_advisory(features, alert_ctx, valid_until)
        elif request.domain == AdvisoryDomain.DISASTER:
            return self._build_disaster_advisory(features, alert_ctx, valid_until)
        else:
            return self._build_urban_advisory(features, alert_ctx, valid_until)

    def _build_agriculture_advisory(
        self, features: Dict[str, float], alerts: List[Dict[str, Any]], valid_until: str
    ) -> AdvisoryResponse:
        recs: List[ActionRecommendation] = []
        rain_rate = features.get("rainfall_rate")
        pop = features.get("precipitation_probability")
        temp = features.get("temperature")
        wind = features.get("wind_speed")

        # 1. Spraying Window — only use live fields when present
        wet = (rain_rate is not None and rain_rate > 2.0) or (pop is not None and pop > 60) or (
            wind is not None and wind > 20
        )
        if wet:
            recs.append(
                ActionRecommendation(
                    action="Postpone chemical and pesticide spraying operations.",
                    urgency="immediate",
                    priority=1,
                    reason=f"High precipitation risk ({pop}% PoP) and wind speed ({wind} km/h) will cause chemical wash-off and spray drift.",
                    safety_warning="Chemical runoff can contaminate nearby water sources during heavy rainfall."
                )
            )
        else:
            recs.append(
                ActionRecommendation(
                    action="Optimal spraying window open for next 12-18 hours.",
                    urgency="planning",
                    priority=3,
                    reason="Low wind speeds and minimal rain probability facilitate effective absorption.",
                )
            )

        # 2. Irrigation Scheduling
        if (rain_rate is not None and rain_rate > 5.0) or (
            features.get("rainfall_total") is not None and features.get("rainfall_total") > 15.0
        ):
            recs.append(
                ActionRecommendation(
                    action="Suspend field irrigation and ensure drainage in low-lying crop fields.",
                    urgency="immediate",
                    priority=1,
                    reason=f"Significant rainfall ({features.get('rainfall_total')} mm) expected; prevent waterlogging and root rot.",
                )
            )
        elif temp is not None and temp > 36.0:
            recs.append(
                ActionRecommendation(
                    action="Provide light, frequent evening irrigation to mitigate crop heat stress.",
                    urgency="moderate",
                    priority=2,
                    reason=f"High daytime ambient temperature ({temp}°C) increases soil evapotranspiration.",
                )
            )

        # 3. Harvest Protection
        if alerts:
            recs.append(
                ActionRecommendation(
                    action="Cover harvested produce and store in elevated dry sheds.",
                    urgency="immediate",
                    priority=1,
                    reason=f"Official warning in effect: {alerts[0].get('headline')}.",
                    safety_warning="Prevent moisture spoilage and fungal growth."
                )
            )

        severity = RiskLevel.HIGH if (
            (rain_rate is not None and rain_rate > 10.0) or len(alerts) > 0
        ) else (
            RiskLevel.MODERATE if (pop is not None and pop > 50) else RiskLevel.LOW
        )

        title = "Agricultural Operations & Crop Weather Advisory"
        summary = (
            "Advisory for farming operations: "
            f"{f'Rain probability {pop}%, ' if pop is not None else ''}"
            f"{f'Temperature {temp}°C. ' if temp is not None else ''}"
            f"{'Suspension of spraying advised due to active rain.' if (rain_rate is not None and rain_rate > 0) else 'Monitor live updates for crop management.'}"
        )

        return AdvisoryResponse(
            domain=AdvisoryDomain.AGRICULTURE,
            severity=severity,
            title=title,
            summary=summary,
            recommendations=recs,
            valid_until=valid_until,
        )

    def _build_travel_advisory(
        self, features: Dict[str, float], alerts: List[Dict[str, Any]], valid_until: str
    ) -> AdvisoryResponse:
        recs: List[ActionRecommendation] = []
        vis = features.get("visibility")
        wind = features.get("wind_gust")
        rain = features.get("rainfall_rate")

        if vis is not None and vis < 2.0:
            recs.append(
                ActionRecommendation(
                    action="Maintain low speeds, use low-beam fog lights, and increase following distance on highways.",
                    urgency="immediate",
                    priority=1,
                    reason=f"Reduced visibility ({vis} km) severely impairs stopping distance.",
                    safety_warning="Dense fog / low visibility hazard on highway routes."
                )
            )

        if (rain is not None and rain > 15.0) or (wind is not None and wind > 45.0):
            recs.append(
                ActionRecommendation(
                    action="Expect highway waterlogging and delays in suburban rail or road transit.",
                    urgency="immediate",
                    priority=1,
                    reason=f"Intense rainfall ({rain} mm/h) and wind gusts ({wind} km/h) create hydroplaning and localized inundation risks.",
                )
            )
        else:
            recs.append(
                ActionRecommendation(
                    action="Transit conditions are stable; standard travel precautions apply.",
                    urgency="planning",
                    priority=3,
                    reason="No major visibility or severe inundation barriers observed.",
                )
            )

        severity = RiskLevel.HIGH if (
            (vis is not None and vis < 2.0) or (rain is not None and rain > 15.0) or len(alerts) > 0
        ) else (
            RiskLevel.MODERATE if (rain is not None and rain > 5.0) else RiskLevel.LOW
        )

        return AdvisoryResponse(
            domain=AdvisoryDomain.TRAVEL,
            severity=severity,
            title="Travel & Commute Road Weather Advisory",
            summary=(
                "Commuter advisory: "
                + (f"Visibility {vis} km, " if vis is not None else "")
                + (f"Gusts {wind} km/h, " if wind is not None else "")
                + (f"Rain rate {rain} mm/h." if rain is not None else "partial live weather.")
            ),
            recommendations=recs,
            valid_until=valid_until,
        )

    def _build_disaster_advisory(
        self, features: Dict[str, float], alerts: List[Dict[str, Any]], valid_until: str
    ) -> AdvisoryResponse:
        recs: List[ActionRecommendation] = []
        storm = features.get("storm_indicator")
        rain_total = features.get("rainfall_total")

        if alerts:
            top_al = alerts[0]
            recs.append(
                ActionRecommendation(
                    action=f"Follow local Disaster Management Authority (SDMA/NDRF) instructions immediately.",
                    urgency="immediate",
                    priority=1,
                    reason=f"Official IMD Warning: {top_al.get('headline')}",
                    safety_warning=top_al.get("instruction") or "Stay indoors and away from electrical installations.",
                )
            )

        if storm is not None and storm > 0.5:
            recs.append(
                ActionRecommendation(
                    action="Seek shelter in sturdy concrete structures; stay away from tall trees and tin sheds.",
                    urgency="immediate",
                    priority=1,
                    reason="High convective storm and lightning discharge hazard.",
                )
            )

        if rain_total is not None and rain_total > 50.0:
            recs.append(
                ActionRecommendation(
                    action="Prepare emergency go-bag (documents, torch, drinking water, medicine) and avoid basement parking.",
                    urgency="immediate",
                    priority=1,
                    reason=f"Cumulative rainfall {rain_total} mm presents severe urban waterlogging risk.",
                )
            )

        severity = RiskLevel.EXTREME if any(a.get("severity") == "RED" for a in alerts) else (
            RiskLevel.HIGH if len(alerts) > 0 or (rain_total is not None and rain_total > 50) else RiskLevel.MODERATE
        )

        return AdvisoryResponse(
            domain=AdvisoryDomain.DISASTER,
            severity=severity,
            title="Civil Protection & Disaster Preparedness Advisory",
            summary=f"Disaster advisory: {len(alerts)} active official warning(s). Follow official directives.",
            recommendations=recs,
            valid_until=valid_until,
        )

    def _build_urban_advisory(
        self, features: Dict[str, float], alerts: List[Dict[str, Any]], valid_until: str
    ) -> AdvisoryResponse:
        recs: List[ActionRecommendation] = []
        feels = features.get("feels_like")
        pop = features.get("precipitation_probability")
        uv = features.get("uv_index")

        if pop is not None and pop > 50:
            recs.append(
                ActionRecommendation(
                    action="Carry an umbrella or rain gear when heading outdoors.",
                    urgency="moderate",
                    priority=2,
                    reason=f"Precipitation probability is {pop}%.",
                )
            )

        if feels is not None and feels > 40.0:
            recs.append(
                ActionRecommendation(
                    action="Hydrate frequently and minimize strenuous outdoor activities between 12 PM - 3 PM.",
                    urgency="immediate",
                    priority=1,
                    reason=f"Heat index feels like {feels}°C with high humidity discomfort.",
                )
            )
        elif uv is not None and uv > 7.0:
            recs.append(
                ActionRecommendation(
                    action="Use SPF 30+ sunscreen and wear sunglasses for UV protection.",
                    urgency="planning",
                    priority=3,
                    reason=f"Very High UV Index ({uv}).",
                )
            )
        else:
            recs.append(
                ActionRecommendation(
                    action="Conditions are favorable for outdoor recreation and regular commutes.",
                    urgency="planning",
                    priority=3,
                    reason="Based on available live weather fields.",
                )
            )

        severity = RiskLevel.HIGH if (
            (feels is not None and feels > 43) or (pop is not None and pop > 80)
        ) else (
            RiskLevel.MODERATE if (
                (feels is not None and feels > 38) or (pop is not None and pop > 50)
            ) else RiskLevel.LOW
        )
        return AdvisoryResponse(
            domain=AdvisoryDomain.URBAN_GENERAL,
            severity=severity,
            title="Urban Lifestyle & Daily Activity Weather Advisory",
            summary=(
                "Daily advisory: "
                + (f"Feels like {feels}°C, " if feels is not None else "")
                + (f"Rain chance {pop}%, " if pop is not None else "")
                + (f"UV Index {uv}." if uv is not None else "partial live weather.")
            ),
            recommendations=recs,
            valid_until=valid_until,
        )
