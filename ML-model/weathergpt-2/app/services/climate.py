"""Climate / multi-year statistics from live ERA5 archive — not mock station JSON.

Does not invent multi-decadal climate-change trends or p-values.
"""
from __future__ import annotations

from datetime import date, timedelta

from app.core.nwp_config import ERA5_LAG_DAYS, MAX_HISTORICAL_YEARS, threshold
from app.models.climate import (
    ClimateMetric,
    ClimateTrendRequest,
    ClimateTrendResponse,
    TrendDirection,
)
from app.services.context import geocode_if_needed
from app.services.historical_analysis import summarize_daily
from app.services.weather import fetch_historical_daily


def _unavailable(
    location_name: str,
    metric: ClimateMetric,
    narrative: str,
    source_notes: str,
) -> ClimateTrendResponse:
    return ClimateTrendResponse(
        available=False,
        location_name=location_name,
        metric=metric,
        period="unavailable",
        trend_direction=TrendDirection.VARIABLE,
        rate_of_change="unavailable",
        statistical_significance_p_value=None,
        historical_mean=None,
        historical_min=None,
        historical_max=None,
        annual_summary={},
        summary_narrative=narrative,
        methodology=(
            "Live ERA5 via Open-Meteo Historical Weather API when available. "
            "WeatherGPT does not fabricate climate trends or significance tests."
        ),
        limitations=(
            "Multi-decadal climate-change attribution and monsoon-onset climatology "
            "are not provided from short reanalysis windows. Missing data is reported, not filled."
        ),
        source_notes=source_notes,
    )


def analyze_climate(request: ClimateTrendRequest) -> ClimateTrendResponse:
    resolved = geocode_if_needed(request.location)
    loc_name = resolved.get("name") or (request.location.name if request.location else None) or "Unknown location"
    if resolved.get("lat") is None or resolved.get("lon") is None:
        return _unavailable(
            loc_name,
            request.metric,
            resolved.get("error") or "Location could not be resolved for climate analysis.",
            "climate: geocode_unavailable",
        )

    years = min(int(request.period_years), MAX_HISTORICAL_YEARS)
    end = date.today() - timedelta(days=ERA5_LAG_DAYS)
    start = date(end.year - years, end.month, end.day)

    if request.metric == ClimateMetric.MONSOON_ONSET:
        return _unavailable(
            loc_name,
            request.metric,
            (
                f"Monsoon-onset climatology is not available from the current live services "
                f"for {loc_name}. WeatherGPT does not invent onset dates."
            ),
            "climate: monsoon_onset_unavailable",
        )

    bundle = fetch_historical_daily(
        float(resolved["lat"]),
        float(resolved["lon"]),
        start.isoformat(),
        end.isoformat(),
    )
    if not bundle.get("available"):
        return _unavailable(
            loc_name,
            request.metric,
            bundle.get("error") or "Historical archive unavailable for climate analysis.",
            f"climate: archive_error; {bundle.get('detail') or ''}".strip(),
        )

    rows = bundle.get("daily") or []
    stats = summarize_daily(rows)
    period_label = f"{start.isoformat()} to {end.isoformat()} (ERA5, {years} years capped)"

    if request.metric == ClimateMetric.TEMPERATURE:
        hist_mean = stats.get("average_temperature_c")
        hist_min = stats.get("minimum_temperature_c")
        hist_max = stats.get("maximum_temperature_c")
        if hist_mean is None:
            return _unavailable(
                loc_name,
                request.metric,
                "Temperature statistics unavailable for this archive window.",
                "climate: incomplete_temperature",
            )
        narrative = (
            f"ERA5 multi-year temperature record for {loc_name} ({period_label}): "
            f"mean {hist_mean}°C, min {hist_min}°C, max {hist_max}°C. "
            "This is a multi-year reanalysis summary, not a long-term climate-change trend."
        )
        annual = {
            "average_temperature_c": hist_mean,
            "maximum_temperature_c": hist_max,
            "minimum_temperature_c": hist_min,
            "hot_days": stats.get("hot_days"),
            "very_hot_days": stats.get("very_hot_days"),
        }
    elif request.metric in (ClimateMetric.RAINFALL, ClimateMetric.EXTREME_EVENTS):
        hist_mean = stats.get("average_daily_rainfall_mm")
        hist_min = 0.0
        hist_max = stats.get("maximum_daily_rainfall_mm")
        if hist_mean is None and stats.get("total_rainfall_mm") is None:
            return _unavailable(
                loc_name,
                request.metric,
                "Rainfall statistics unavailable for this archive window.",
                "climate: incomplete_rainfall",
            )
        if hist_mean is None:
            hist_mean = 0.0
        extreme_th = threshold("heavy_rain_24h_mm")
        narrative = (
            f"ERA5 multi-year rainfall record for {loc_name} ({period_label}): "
            f"total {stats.get('total_rainfall_mm')} mm, mean daily {hist_mean} mm, "
            f"max daily {hist_max} mm, extreme-rain days (≥{extreme_th} mm, WeatherGPT screening) "
            f"= {stats.get('extreme_rainfall_days')}. "
            "Not an official warning threshold and not a climate-change attribution."
        )
        annual = {
            "total_rainfall_mm": stats.get("total_rainfall_mm"),
            "average_daily_rainfall_mm": hist_mean,
            "maximum_daily_rainfall_mm": hist_max,
            "rainy_days": stats.get("rainy_days"),
            "extreme_rainfall_days": stats.get("extreme_rainfall_days"),
            "very_heavy_rainfall_days": stats.get("very_heavy_rainfall_days"),
        }
    else:
        return _unavailable(
            loc_name,
            request.metric,
            f"Metric {request.metric.value} is not supported from live archive statistics.",
            "climate: unsupported_metric",
        )

    return ClimateTrendResponse(
        available=True,
        location_name=loc_name,
        metric=request.metric,
        period=period_label,
        trend_direction=TrendDirection.VARIABLE,
        rate_of_change=(
            "not computed — multi-decadal climate trends are not claimed from "
            f"ERA5 windows ≤{MAX_HISTORICAL_YEARS} years"
        ),
        statistical_significance_p_value=None,
        historical_mean=float(hist_mean),
        historical_min=float(hist_min) if hist_min is not None else None,
        historical_max=float(hist_max) if hist_max is not None else None,
        annual_summary=annual,
        summary_narrative=narrative,
        methodology=(
            "Statistics computed from Open-Meteo Historical Weather API (ERA5 reanalysis). "
            "Rate-of-change and p-values are not fabricated."
        ),
        limitations=(
            f"Window clamped to ≤{MAX_HISTORICAL_YEARS} years with ~{ERA5_LAG_DAYS}-day ERA5 lag. "
            "Reanalysis is not station observations. Extreme-day counts use WeatherGPT screening thresholds."
        ),
        source_notes="climate: open_meteo_historical_archive",
    )
