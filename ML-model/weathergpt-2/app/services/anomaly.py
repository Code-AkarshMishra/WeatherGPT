"""Anomaly detection against live ERA5 same-month statistics + live observations."""
from datetime import date

from app.ml.anomaly import AnomalyEngine
from app.models.anomaly import AnomalyDetectRequest, AnomalyDetectResponse
from app.services.baselines import era5_same_month_baseline
from app.services.context import build_weather_context


def detect_anomalies(request: AnomalyDetectRequest) -> AnomalyDetectResponse:
    ctx = build_weather_context(
        location=request.location,
        weather_override=request.observed_values,
        forecast_override=[] if request.observed_values else None,
        alert_override=[] if request.observed_values else None,
    )
    month_idx = request.month or date.today().month
    weather = request.observed_values or ctx["weather"]
    location_name = ctx["location_name"]

    if not weather:
        return AnomalyDetectResponse(
            location_name=location_name,
            month_analyzed=__import__("calendar").month_name[month_idx],
            baseline_period="unavailable",
            anomalies_detected=0,
            results=[],
            interpretation=(
                "Observed weather unavailable. Anomaly analysis was not run "
                "and values were not fabricated."
            ),
            source_notes=ctx.get("source_notes"),
        )

    if ctx.get("lat") is None or ctx.get("lon") is None:
        return AnomalyDetectResponse(
            location_name=location_name,
            month_analyzed=__import__("calendar").month_name[month_idx],
            baseline_period="unavailable",
            anomalies_detected=0,
            results=[],
            interpretation=(
                "Coordinates unavailable for ERA5 baseline. "
                "Do not invent climatological normals."
            ),
            source_notes=ctx.get("source_notes"),
        )

    baseline_bundle = era5_same_month_baseline(
        float(ctx["lat"]), float(ctx["lon"]), month=month_idx
    )
    if not baseline_bundle.get("available"):
        return AnomalyDetectResponse(
            location_name=location_name,
            month_analyzed=__import__("calendar").month_name[month_idx],
            baseline_period="unavailable",
            anomalies_detected=0,
            results=[],
            interpretation=(
                baseline_bundle.get("error")
                or "ERA5 baseline unavailable. Anomaly analysis was not run."
            ),
            source_notes=f"{ctx.get('source_notes')}; baseline: unavailable",
        )

    source_notes = (
        f"{ctx['source_notes']}; baseline: ERA5 same-month "
        f"({baseline_bundle.get('lookback_years')}y)"
    )
    return AnomalyEngine.analyze_anomalies(
        location_name=location_name,
        observed_weather=weather,
        historical_baseline=baseline_bundle.get("historical_baseline") or {},
        month_idx=month_idx,
        target_metric=request.metric,
        source_notes=source_notes,
        baseline_period=(
            f"ERA5 same-month {baseline_bundle.get('period', {}).get('start')} to "
            f"{baseline_bundle.get('period', {}).get('end')} "
            f"({baseline_bundle.get('note')})"
        ),
    )
