"""ERA5-derived monthly statistics for anomaly / flood context.

Does not load mock_baselines.json. Missing archive data → unavailable.
"""
from __future__ import annotations

import math
from calendar import month_name
from datetime import date
from typing import Any, Optional

from app.core.nwp_config import ERA5_LAG_DAYS, MAX_HISTORICAL_YEARS
from app.services.weather import fetch_historical_daily


def _mean(values: list[float]) -> Optional[float]:
    if not values:
        return None
    return sum(values) / len(values)


def _std(values: list[float]) -> Optional[float]:
    if len(values) < 2:
        return None
    m = _mean(values)
    if m is None:
        return None
    var = sum((v - m) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(var)


def era5_same_month_baseline(
    latitude: float,
    longitude: float,
    month: Optional[int] = None,
    lookback_years: int = 5,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Mean/std of ERA5 daily values for the same calendar month over recent years."""
    month = month or date.today().month
    lookback_years = max(1, min(lookback_years, MAX_HISTORICAL_YEARS))
    end = date.today() - __import__("datetime").timedelta(days=ERA5_LAG_DAYS)
    start = date(end.year - lookback_years, end.month, end.day)
    bundle = fetch_historical_daily(
        latitude, longitude, start.isoformat(), end.isoformat(), use_cache=use_cache
    )
    if not bundle.get("available"):
        return {
            "available": False,
            "error": bundle.get("error") or "Historical archive unavailable.",
            "detail": bundle.get("detail"),
        }
    temps: list[float] = []
    rains: list[float] = []
    for row in bundle.get("daily") or []:
        day = str(row.get("date") or "")
        if len(day) < 7 or day[5:7] != f"{month:02d}":
            continue
        if row.get("mean_temp_c") is not None:
            try:
                temps.append(float(row["mean_temp_c"]))
            except (TypeError, ValueError):
                pass
        elif row.get("temp_max_c") is not None:
            try:
                temps.append(float(row["temp_max_c"]))
            except (TypeError, ValueError):
                pass
        if row.get("precipitation_mm") is not None:
            try:
                rains.append(float(row["precipitation_mm"]))
            except (TypeError, ValueError):
                pass
    if not temps and not rains:
        return {
            "available": False,
            "error": f"No ERA5 samples for month {month_name[month]} in the requested window.",
        }
    mean_temp = _mean(temps)
    std_temp = _std(temps)
    mean_rain = _mean(rains)
    std_rain = _std(rains)
    month_key = month_name[month].lower()
    return {
        "available": True,
        "source": "open_meteo_historical_archive",
        "dataset": bundle.get("dataset"),
        "month": month_key,
        "month_idx": month,
        "lookback_years": lookback_years,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "sample_days_temp": len(temps),
        "sample_days_rain": len(rains),
        "mean_temp_c": round(mean_temp, 2) if mean_temp is not None else None,
        "std_temp_c": round(std_temp, 2) if std_temp is not None else None,
        "daily_mean_rainfall_mm": round(mean_rain, 2) if mean_rain is not None else None,
        "daily_std_rainfall_mm": round(std_rain, 2) if std_rain is not None else None,
        "maximum_daily_rainfall_mm": round(max(rains), 1) if rains else None,
        # Shape compatible with AnomalyEngine monthly block keys
        "historical_baseline": {
            month_key: {
                "mean_temp": round(mean_temp, 2) if mean_temp is not None else None,
                "std_temp": round(std_temp, 2) if std_temp is not None else None,
                "daily_mean_rainfall": round(mean_rain, 2) if mean_rain is not None else None,
                "daily_std_rainfall": round(std_rain, 2) if std_rain is not None else None,
            }
        },
        "note": (
            "ERA5 reanalysis same-month statistics — not an official IMD climate normal "
            "and not a multi-decadal climate-change trend."
        ),
    }
