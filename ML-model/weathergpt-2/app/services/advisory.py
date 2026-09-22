"""Domain advisory engine for agriculture, travel, disaster, and urban use.

Uses only provided live weather fields. Missing values are never invented.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.ml.features import FeatureExtractor
from app.models.advisory import (
    ActionRecommendation,
    AdvisoryDomain,
    AdvisoryRequest,
    AdvisoryResponse,
)
from app.models.risk import RiskLevel
from app.services.context import build_weather_context


def _num(features: dict[str, float], key: str) -> Optional[float]:
    val = features.get(key)
    return float(val) if val is not None else None


def _unavailable(domain: AdvisoryDomain, valid_until: str, notes: Optional[str]) -> AdvisoryResponse:
    return AdvisoryResponse(
        domain=domain,
        severity=RiskLevel.LOW,
        title="Weather advisory unavailable",
        summary=(
            "Live weather inputs are unavailable. WeatherGPT does not invent temperature, "
            "rainfall, wind, or other meteorological values for advisories."
        ),
        recommendations=[
            ActionRecommendation(
                action="Retry when live weather data is available, or supply observed weather_context.",
                urgency="planning",
                priority=3,
                reason="Required meteorological fields were missing.",
            )
        ],
        valid_until=valid_until,
        source_notes=notes,
    )


def generate_advisory(request: AdvisoryRequest) -> AdvisoryResponse:
    ctx = build_weather_context(
        location=request.location,
        weather_override=request.weather_context,
        forecast_override=request.forecast_context,
        alert_override=request.alert_context,
    )
    features, missing = FeatureExtractor.extract_features(
        ctx["weather"], ctx["forecast"], ctx["alerts"]
    )
    valid_until = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    has_weather = any(
        not missing.get(k, True)
        for k in (
            "temperature",
            "rainfall_rate",
            "rainfall_total",
            "precipitation_probability",
            "wind_speed",
            "wind_gust",
            "visibility",
            "feels_like",
            "uv_index",
            "storm_indicator",
        )
    )
    if not has_weather and not ctx["alerts"]:
        return _unavailable(request.domain, valid_until, ctx["source_notes"])

    builders = {
        AdvisoryDomain.AGRICULTURE: _build_agriculture_advisory,
        AdvisoryDomain.TRAVEL: _build_travel_advisory,
        AdvisoryDomain.DISASTER: _build_disaster_advisory,
        AdvisoryDomain.URBAN_GENERAL: _build_urban_advisory,
    }
    builder = builders.get(request.domain, _build_urban_advisory)
    advisory = builder(features, ctx["alerts"], valid_until)
    advisory.source_notes = ctx["source_notes"]
    return advisory


def _build_agriculture_advisory(
    features: dict[str, float],
    alerts: list[dict[str, Any]],
    valid_until: str,
) -> AdvisoryResponse:
    recs: list[ActionRecommendation] = []
    rain_rate = _num(features, "rainfall_rate")
    pop = _num(features, "precipitation_probability")
    temp = _num(features, "temperature")
    wind = _num(features, "wind_speed")
    rain_total = _num(features, "rainfall_total")

    wet = (rain_rate is not None and rain_rate > 2.0) or (pop is not None and pop > 60) or (
        wind is not None and wind > 20
    )
    if wet:
        parts = []
        if pop is not None:
            parts.append(f"PoP {pop}%")
        if wind is not None:
            parts.append(f"wind {wind} km/h")
        if rain_rate is not None:
            parts.append(f"rain rate {rain_rate} mm/h")
        recs.append(
            ActionRecommendation(
                action="Postpone chemical and pesticide spraying operations.",
                urgency="immediate",
                priority=1,
                reason=(
                    "Elevated precipitation/wind risk from live data"
                    + (f" ({', '.join(parts)})" if parts else "")
                    + "."
                ),
                safety_warning="Chemical runoff can contaminate nearby water during heavy rain.",
            )
        )
    elif rain_rate is not None or pop is not None or wind is not None:
        recs.append(
            ActionRecommendation(
                action="Optimal spraying window open for next 12-18 hours.",
                urgency="planning",
                priority=3,
                reason="Low wind and minimal rain probability in available live fields.",
            )
        )

    if (rain_rate is not None and rain_rate > 5.0) or (
        rain_total is not None and rain_total > 15.0
    ):
        recs.append(
            ActionRecommendation(
                action="Suspend field irrigation and ensure drainage in low-lying crop fields.",
                urgency="immediate",
                priority=1,
                reason=(
                    f"Significant rainfall in live data"
                    + (f" (total {rain_total} mm)" if rain_total is not None else "")
                    + "."
                ),
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

    if alerts:
        recs.append(
            ActionRecommendation(
                action="Cover harvested produce and store in elevated dry sheds.",
                urgency="immediate",
                priority=1,
                reason=f"Warning in bulletin set: {alerts[0].get('headline')}.",
                safety_warning="Prevent moisture spoilage and fungal growth.",
            )
        )

    if not recs:
        recs.append(
            ActionRecommendation(
                action="Insufficient live fields for a detailed farm advisory; monitor updates.",
                urgency="planning",
                priority=3,
                reason="Some meteorological fields were unavailable.",
            )
        )

    severity = RiskLevel.HIGH if (
        (rain_rate is not None and rain_rate > 10.0) or alerts
    ) else (
        RiskLevel.MODERATE if (pop is not None and pop > 50) else RiskLevel.LOW
    )
    summary_bits = []
    if pop is not None:
        summary_bits.append(f"Rain probability {pop}%")
    if temp is not None:
        summary_bits.append(f"Temperature {temp}°C")
    summary = (
        "Advisory for farming operations: "
        + (", ".join(summary_bits) if summary_bits else "partial live weather only")
        + "."
    )
    return AdvisoryResponse(
        domain=AdvisoryDomain.AGRICULTURE,
        severity=severity,
        title="Agricultural Operations & Crop Weather Advisory",
        summary=summary,
        recommendations=recs,
        valid_until=valid_until,
    )


def _build_travel_advisory(
    features: dict[str, float],
    alerts: list[dict[str, Any]],
    valid_until: str,
) -> AdvisoryResponse:
    recs: list[ActionRecommendation] = []
    vis = _num(features, "visibility")
    wind = _num(features, "wind_gust")
    rain = _num(features, "rainfall_rate")

    if vis is not None and vis < 2.0:
        recs.append(
            ActionRecommendation(
                action="Maintain low speeds, use low-beam fog lights, and increase following distance.",
                urgency="immediate",
                priority=1,
                reason=f"Reduced visibility ({vis} km) impairs stopping distance.",
                safety_warning="Dense fog / low visibility hazard on highway routes.",
            )
        )

    if (rain is not None and rain > 15.0) or (wind is not None and wind > 45.0):
        recs.append(
            ActionRecommendation(
                action="Expect highway waterlogging and delays in suburban rail or road transit.",
                urgency="immediate",
                priority=1,
                reason=(
                    f"Intense rainfall/wind in live data"
                    + (f" (rain {rain} mm/h)" if rain is not None else "")
                    + (f", gusts {wind} km/h" if wind is not None else "")
                    + "."
                ),
            )
        )
    elif vis is not None or rain is not None or wind is not None:
        recs.append(
            ActionRecommendation(
                action="Transit conditions are stable; standard travel precautions apply.",
                urgency="planning",
                priority=3,
                reason="No major visibility or severe inundation barriers in available live fields.",
            )
        )

    if not recs:
        recs.append(
            ActionRecommendation(
                action="Travel advisory limited: visibility/rain/wind fields unavailable.",
                urgency="planning",
                priority=3,
                reason="Missing live meteorological inputs.",
            )
        )

    severity = RiskLevel.HIGH if (
        (vis is not None and vis < 2.0) or (rain is not None and rain > 15.0) or alerts
    ) else (
        RiskLevel.MODERATE if (rain is not None and rain > 5.0) else RiskLevel.LOW
    )
    parts = []
    if vis is not None:
        parts.append(f"Visibility {vis} km")
    if wind is not None:
        parts.append(f"Gusts {wind} km/h")
    if rain is not None:
        parts.append(f"Rain rate {rain} mm/h")
    return AdvisoryResponse(
        domain=AdvisoryDomain.TRAVEL,
        severity=severity,
        title="Travel & Commute Road Weather Advisory",
        summary="Commuter advisory: " + (", ".join(parts) if parts else "partial live weather only") + ".",
        recommendations=recs,
        valid_until=valid_until,
    )


def _build_disaster_advisory(
    features: dict[str, float],
    alerts: list[dict[str, Any]],
    valid_until: str,
) -> AdvisoryResponse:
    recs: list[ActionRecommendation] = []
    storm = _num(features, "storm_indicator")
    rain_total = _num(features, "rainfall_total")

    if alerts:
        top_al = alerts[0]
        recs.append(
            ActionRecommendation(
                action="Follow local Disaster Management Authority (SDMA/NDRF) instructions immediately.",
                urgency="immediate",
                priority=1,
                reason=f"Warning bulletin: {top_al.get('headline')}",
                safety_warning=top_al.get("instruction")
                or "Stay indoors and away from electrical installations.",
            )
        )

    if storm is not None and storm > 0.5:
        recs.append(
            ActionRecommendation(
                action="Seek shelter in sturdy concrete structures; stay away from tall trees and tin sheds.",
                urgency="immediate",
                priority=1,
                reason="High convective storm and lightning discharge hazard in live indicators.",
            )
        )

    if rain_total is not None and rain_total > 50.0:
        recs.append(
            ActionRecommendation(
                action="Prepare an emergency go-bag and avoid basement parking.",
                urgency="immediate",
                priority=1,
                reason=f"Cumulative rainfall {rain_total} mm presents urban waterlogging risk.",
            )
        )

    if not recs:
        recs.append(
            ActionRecommendation(
                action="No extreme disaster triggers in available live data; keep monitoring official bulletins.",
                urgency="planning",
                priority=3,
                reason="No matching high-severity storm or flood indicators in provided fields.",
            )
        )

    severity = (
        RiskLevel.EXTREME
        if any(str(item.get("severity")) == "RED" for item in alerts)
        else (
            RiskLevel.HIGH
            if alerts or (rain_total is not None and rain_total > 50)
            else RiskLevel.MODERATE
        )
    )
    return AdvisoryResponse(
        domain=AdvisoryDomain.DISASTER,
        severity=severity,
        title="Civil Protection & Disaster Preparedness Advisory",
        summary=f"Disaster advisory: {len(alerts)} official warning(s) in supplied context.",
        recommendations=recs,
        valid_until=valid_until,
    )


def _build_urban_advisory(
    features: dict[str, float],
    alerts: list[dict[str, Any]],
    valid_until: str,
) -> AdvisoryResponse:
    recs: list[ActionRecommendation] = []
    feels = _num(features, "feels_like")
    pop = _num(features, "precipitation_probability")
    uv = _num(features, "uv_index")

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
                action="Hydrate frequently and minimize strenuous outdoor activity between 12 PM and 3 PM.",
                urgency="immediate",
                priority=1,
                reason=f"Heat index feels like {feels}°C.",
            )
        )
    elif uv is not None and uv > 7.0:
        recs.append(
            ActionRecommendation(
                action="Use SPF 30+ sunscreen and wear sunglasses for UV protection.",
                urgency="planning",
                priority=3,
                reason=f"Very high UV Index ({uv}).",
            )
        )
    elif feels is not None or pop is not None or uv is not None:
        recs.append(
            ActionRecommendation(
                action="Conditions are favorable for outdoor recreation and regular commutes.",
                urgency="planning",
                priority=3,
                reason="Comfortable levels in available live fields.",
            )
        )
    else:
        recs.append(
            ActionRecommendation(
                action="Urban advisory limited: feels-like / rain chance / UV unavailable.",
                urgency="planning",
                priority=3,
                reason="Missing live meteorological inputs.",
            )
        )

    severity = RiskLevel.HIGH if (
        (feels is not None and feels > 43) or (pop is not None and pop > 80)
    ) else (
        RiskLevel.MODERATE
        if ((feels is not None and feels > 38) or (pop is not None and pop > 50))
        else RiskLevel.LOW
    )
    parts = []
    if feels is not None:
        parts.append(f"Feels like {feels}°C")
    if pop is not None:
        parts.append(f"Rain chance {pop}%")
    if uv is not None:
        parts.append(f"UV Index {uv}")
    return AdvisoryResponse(
        domain=AdvisoryDomain.URBAN_GENERAL,
        severity=severity,
        title="Urban Lifestyle & Daily Activity Weather Advisory",
        summary="Daily advisory: " + (", ".join(parts) if parts else "partial live weather only") + ".",
        recommendations=recs,
        valid_until=valid_until,
    )
