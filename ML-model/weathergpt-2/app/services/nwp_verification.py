"""GFS / ECMWF previous-run verification against ERA5 reanalysis.

Uses Open-Meteo Previous Runs API (lead-time offset previous_day1 = 24 h).
Observations come from the existing archive fetch — never fabricated.

This is location- and period-specific skill. It does not mean one model is
always better than the other.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any, Optional

import httpx

from app.core.nwp_config import (
    ARCHIVE_HTTP_TIMEOUT,
    HISTORICAL_CACHE_TTL_SECONDS,
    NWP_ARCHIVE_MIN_DATE,
    PREVIOUS_RUNS_ECMWF_MODEL,
    PREVIOUS_RUNS_GFS_MODEL,
    PREVIOUS_RUNS_URL,
    threshold,
)
from app.services.nwp import _TtlCache
from app.services.weather import fetch_historical_daily

_CACHE = _TtlCache(HISTORICAL_CACHE_TTL_SECONDS)

PREVIOUS_RUN_HOURLY = [
    "precipitation_previous_day1",
    "temperature_2m_previous_day1",
    "wind_speed_10m_previous_day1",
]


def _num(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def clamp_nwp_archive_window(start: str, end: str) -> dict[str, Any]:
    """Previous-runs coverage is mostly from 2024-01-01 (Open-Meteo)."""
    min_d = date.fromisoformat(NWP_ARCHIVE_MIN_DATE)
    start_d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    notes: list[str] = []
    if end_d < min_d:
        return {
            "available": False,
            "error": (
                f"Archived GFS/ECMWF previous-runs data is not available before {NWP_ARCHIVE_MIN_DATE}."
            ),
        }
    if start_d < min_d:
        start_d = min_d
        notes.append(f"NWP archive start clamped to {NWP_ARCHIVE_MIN_DATE}.")
    # Keep verification tractable: max 366 days of hourly previous-runs.
    if (end_d - start_d).days > 366:
        start_d = end_d - timedelta(days=365)
        notes.append("NWP verification window limited to 366 days of previous-run data.")
    return {
        "available": True,
        "start": start_d.isoformat(),
        "end": end_d.isoformat(),
        "notes": notes,
    }


def parse_previous_runs_hourly(payload: dict[str, Any], model: str) -> dict[str, Any]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    precip = hourly.get("precipitation_previous_day1") or []
    temp = hourly.get("temperature_2m_previous_day1") or []
    wind = hourly.get("wind_speed_10m_previous_day1") or []
    rows = []
    for i, ts in enumerate(times):
        rows.append(
            {
                "time": ts,
                "precipitation_mm": _num(precip[i] if i < len(precip) else None),
                "temperature_c": _num(temp[i] if i < len(temp) else None),
                "wind_speed_kmh": _num(wind[i] if i < len(wind) else None),
            }
        )
    return {
        "model": model,
        "available": True,
        "hourly": rows,
        "hourly_count": len(rows),
        "lead_time": "previous_day1 (forecast issued ~24h before valid time)",
        "source": "open_meteo_previous_runs",
        "endpoint": PREVIOUS_RUNS_URL,
    }


def fetch_previous_runs(
    latitude: float,
    longitude: float,
    start: str,
    end: str,
    model_id: str,
    model_label: str,
    use_cache: bool = True,
) -> dict[str, Any]:
    key = f"pruns:{model_id}:{round(latitude, 3)}:{round(longitude, 3)}:{start}:{end}"
    if use_cache:
        cached = _CACHE.get(key)
        if cached is not None:
            return cached
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start,
        "end_date": end,
        "hourly": ",".join(PREVIOUS_RUN_HOURLY),
        "models": model_id,
        "timezone": "auto",
    }
    try:
        with httpx.Client(timeout=ARCHIVE_HTTP_TIMEOUT) as client:
            response = client.get(PREVIOUS_RUNS_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        return {
            "model": model_label,
            "available": False,
            "error": f"{model_label} archived forecast unavailable",
            "detail": str(exc),
            "hourly": [],
        }
    if isinstance(data, dict) and data.get("error"):
        return {
            "model": model_label,
            "available": False,
            "error": str(data.get("reason") or data.get("error")),
            "hourly": [],
        }
    parsed = parse_previous_runs_hourly(data, model_label)
    parsed["open_meteo_model"] = model_id
    if use_cache:
        _CACHE.set(key, parsed)
    return parsed


def daily_precip_from_hourly(hourly: list[dict[str, Any]]) -> dict[str, float]:
    buckets: dict[str, float] = {}
    counts: dict[str, int] = {}
    for row in hourly:
        ts = str(row.get("time") or "")
        day = ts[:10]
        if len(day) < 10:
            continue
        val = row.get("precipitation_mm")
        if val is None:
            continue
        buckets[day] = buckets.get(day, 0.0) + float(val)
        counts[day] = counts.get(day, 0) + 1
    return {d: round(v, 3) for d, v in buckets.items()}


def daily_mean_from_hourly(hourly: list[dict[str, Any]], key: str) -> dict[str, float]:
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for row in hourly:
        ts = str(row.get("time") or "")
        day = ts[:10]
        val = row.get(key)
        if len(day) < 10 or val is None:
            continue
        sums[day] = sums.get(day, 0.0) + float(val)
        counts[day] = counts.get(day, 0) + 1
    return {d: round(sums[d] / counts[d], 3) for d in sums}


def _metrics(forecast: list[float], observed: list[float], wet_threshold: Optional[float] = None) -> dict[str, Any]:
    n = min(len(forecast), len(observed))
    if n == 0:
        return {"n": 0, "mae": None, "rmse": None, "bias": None, "correlation": None}
    pairs = [(forecast[i], observed[i]) for i in range(n)]
    errors = [f - o for f, o in pairs]
    abs_err = [abs(e) for e in errors]
    mae = sum(abs_err) / n
    rmse = math.sqrt(sum(e * e for e in errors) / n)
    bias = sum(errors) / n
    corr = None
    if n >= 10:
        mf = sum(forecast[:n]) / n
        mo = sum(observed[:n]) / n
        num = sum((forecast[i] - mf) * (observed[i] - mo) for i in range(n))
        df = math.sqrt(sum((forecast[i] - mf) ** 2 for i in range(n)))
        do = math.sqrt(sum((observed[i] - mo) ** 2 for i in range(n)))
        if df > 0 and do > 0:
            corr = num / (df * do)
    result = {
        "n": n,
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "bias": round(bias, 3),
        "correlation": round(corr, 3) if corr is not None else None,
    }
    if wet_threshold is not None:
        wet = [(f, o) for f, o in pairs if o >= wet_threshold]
        if wet:
            wmae = sum(abs(f - o) for f, o in wet) / len(wet)
            result["mae_wet_days"] = round(wmae, 3)
            result["wet_days_n"] = len(wet)
            result["wet_day_threshold_mm"] = wet_threshold
            result["wet_day_note"] = (
                "MAE on days with observed rainfall at/above 1 mm, because rainfall "
                "has many zeros that otherwise dominate MAE."
            )
        else:
            result["mae_wet_days"] = None
            result["wet_days_n"] = 0
    return result


def verify_models(
    latitude: float,
    longitude: float,
    start: str,
    end: str,
    location_name: Optional[str] = None,
    use_cache: bool = True,
) -> dict[str, Any]:
    window = clamp_nwp_archive_window(start, end)
    if not window.get("available"):
        return {
            "available": False,
            "location": location_name,
            "error": window.get("error"),
            "official_warning": False,
        }
    start, end = window["start"], window["end"]
    obs = fetch_historical_daily(latitude, longitude, start, end, use_cache=use_cache)
    if not obs.get("available"):
        return {
            "available": False,
            "location": location_name,
            "error": obs.get("error") or "Observations/reanalysis unavailable.",
            "detail": obs.get("detail"),
        }
    obs_rain = {
        str(r.get("date")): float(r["precipitation_mm"])
        for r in (obs.get("daily") or [])
        if r.get("precipitation_mm") is not None
    }
    obs_temp = {
        str(r.get("date")): float(r["mean_temp_c"])
        for r in (obs.get("daily") or [])
        if r.get("mean_temp_c") is not None
    }

    gfs = fetch_previous_runs(
        latitude, longitude, start, end, PREVIOUS_RUNS_GFS_MODEL, "GFS", use_cache=use_cache
    )
    ecm = fetch_previous_runs(
        latitude, longitude, start, end, PREVIOUS_RUNS_ECMWF_MODEL, "ECMWF", use_cache=use_cache
    )

    def score(model_bundle: dict[str, Any]) -> dict[str, Any]:
        if not model_bundle.get("available"):
            return {
                "available": False,
                "error": model_bundle.get("error"),
                "detail": model_bundle.get("detail"),
            }
        rain_fcst = daily_precip_from_hourly(model_bundle.get("hourly") or [])
        temp_fcst = daily_mean_from_hourly(model_bundle.get("hourly") or [], "temperature_c")
        rain_days = sorted(set(rain_fcst) & set(obs_rain))
        temp_days = sorted(set(temp_fcst) & set(obs_temp))
        rain_pairs = [(rain_fcst[d], obs_rain[d]) for d in rain_days]
        temp_pairs = [(temp_fcst[d], obs_temp[d]) for d in temp_days]
        series = [
            {
                "date": d,
                "forecast_mm": rain_fcst[d],
                "observed_mm": obs_rain[d],
                "error_mm": round(rain_fcst[d] - obs_rain[d], 2),
            }
            for d in rain_days
        ]
        samples = [
            {
                "location": location_name,
                "forecast_issue_offset": "previous_day1",
                "target_time": d,
                "gfs_or_ecmwf": model_bundle.get("model"),
                "rainfall_forecast_mm": rain_fcst.get(d),
                "observed_rainfall_mm": obs_rain.get(d),
                "temperature_forecast_c": temp_fcst.get(d),
                "observed_temperature_c": obs_temp.get(d),
            }
            for d in rain_days[:5]
        ]
        return {
            "available": True,
            "model": model_bundle.get("model"),
            "open_meteo_model": model_bundle.get("open_meteo_model"),
            "lead_time": model_bundle.get("lead_time"),
            "rainfall": _metrics(
                [p[0] for p in rain_pairs],
                [p[1] for p in rain_pairs],
                wet_threshold=threshold("rainy_day_mm"),
            ),
            "temperature": _metrics([p[0] for p in temp_pairs], [p[1] for p in temp_pairs]),
            "series_sample": series[-60:],
            "training_samples_preview": samples,
            "note": "No hazard labels are attached. Preview only — not an ML training set export.",
        }

    gfs_score = score(gfs)
    ecm_score = score(ecm)
    comparison = None
    g_mae = (gfs_score.get("rainfall") or {}).get("mae") if gfs_score.get("available") else None
    e_mae = (ecm_score.get("rainfall") or {}).get("mae") if ecm_score.get("available") else None
    if g_mae is not None and e_mae is not None:
        better = "ECMWF" if e_mae < g_mae else "GFS" if g_mae < e_mae else "tie"
        comparison = {
            "gfs_rainfall_mae": g_mae,
            "ecmwf_rainfall_mae": e_mae,
            "lower_mae": better,
            "interpretation": (
                f"During {start} to {end} at this location, {better} had lower 24h-lead "
                f"rainfall MAE. This is a historical verification result for this place and "
                f"period only — not a claim that one model is always more accurate."
                if better != "tie"
                else (
                    f"During {start} to {end} at this location, GFS and ECMWF 24h-lead "
                    "rainfall MAE were equal in this sample. Not a universal ranking."
                )
            ),
        }

    available = bool(gfs_score.get("available") or ecm_score.get("available"))
    return {
        "available": available,
        "location": location_name,
        "latitude": latitude,
        "longitude": longitude,
        "period": {"start": start, "end": end},
        "observation_source": obs.get("dataset"),
        "lead_time": "previous_day1 (~24 hour forecast lead)",
        "gfs": gfs_score,
        "ecmwf": ecm_score,
        "comparison": comparison,
        "window_notes": window.get("notes") or [],
        "charts": {
            "nwp_predicted_vs_observed": (gfs_score.get("series_sample") if gfs_score.get("available") else None),
            "gfs_vs_ecmwf_error": comparison,
        },
        "official_warning": False,
        "disclaimer": (
            "Verification compares Open-Meteo previous-run NWP (GFS/ECMWF) against ERA5 "
            "reanalysis, not rain-gauge observations. Skill is for this location and period only."
        ),
    }
