"""Historical / climate statistics from the existing Open-Meteo archive fetch.

Gemini never calculates these numbers. This is reanalysis (ERA5 via Open-Meteo),
not station observations and not an official climate-change assessment.
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any, Optional

from app.core.nwp_config import (
    ERA5_LAG_DAYS,
    MAX_HISTORICAL_YEARS,
    threshold,
)
from app.services.location import search_location
from app.services.weather import fetch_historical_daily


SCREENING_NOTE = (
    "WeatherGPT screening threshold — not an official meteorological warning threshold."
)


def archive_end_date(today: Optional[date] = None) -> date:
    return (today or date.today()) - timedelta(days=ERA5_LAG_DAYS)


def parse_period(text: str, today: Optional[date] = None) -> dict[str, Any]:
    """Parse a natural-language or ISO period. Clamps to ERA5 lag and max years."""
    today = today or date.today()
    end = archive_end_date(today)
    start = date(end.year - 1, end.month, end.day)
    label = "last_1_year"
    notes: list[str] = []
    clean = (text or "").lower()

    iso_range = re.search(r"(20\d{2}-\d{2}-\d{2})\s*(?:to|-|/)\s*(20\d{2}-\d{2}-\d{2})", clean)
    year_span = re.search(r"\b(19\d{2}|20\d{2})\s*(?:-|to|through)\s*(19\d{2}|20\d{2})\b", clean)
    single_year = re.search(r"\b((?:19|20)\d{2})\b", clean)

    if iso_range:
        start = date.fromisoformat(iso_range.group(1))
        end = min(date.fromisoformat(iso_range.group(2)), end)
        label = "custom"
    elif year_span:
        y1, y2 = int(year_span.group(1)), int(year_span.group(2))
        if y1 > y2:
            y1, y2 = y2, y1
        start = date(y1, 1, 1)
        end = min(date(y2, 12, 31), archive_end_date(today))
        label = f"{y1}-{y2}"
    elif re.search(r"\blast\s*30\s*days?\b", clean):
        start = end - timedelta(days=29)
        label = "last_30_days"
    elif re.search(r"\blast\s*90\s*days?\b|\blast\s*3\s*months?\b", clean):
        start = end - timedelta(days=89)
        label = "last_90_days"
    elif re.search(r"\blast\s*6\s*months?\b", clean):
        start = end - timedelta(days=182)
        label = "last_6_months"
    elif re.search(r"\blast\s*3\s*years?\b", clean):
        start = date(end.year - 3, end.month, end.day)
        label = "last_3_years"
    elif re.search(r"\blast\s*5\s*years?\b", clean):
        start = date(end.year - 5, end.month, end.day)
        label = "last_5_years"
    elif re.search(r"\blast\s*10\s*years?\b|\bdecade\b", clean):
        start = date(end.year - 10, end.month, end.day)
        label = "last_10_years"
    elif re.search(r"\bthis\s+year\b|\byear[- ]to[- ]date\b|\bYTD\b", clean, re.I):
        start = date(today.year, 1, 1)
        label = "this_year"
    elif re.search(r"\blast\s*(?:1\s*)?year\b|\bpast\s*year\b", clean):
        start = date(end.year - 1, end.month, end.day)
        label = "last_1_year"
    elif single_year and int(single_year.group(1)) < today.year:
        year = int(single_year.group(1))
        start = date(year, 1, 1)
        end = min(date(year, 12, 31), archive_end_date(today))
        label = str(year)

    max_start = date(end.year - MAX_HISTORICAL_YEARS, end.month, end.day)
    if start < max_start:
        start = max_start
        notes.append(
            f"Range clamped to {MAX_HISTORICAL_YEARS} years (Open-Meteo request size limit in this service)."
        )
    if start > end:
        return {
            "available": False,
            "error": "Requested historical range is unavailable (start after archive end).",
            "start": start.isoformat(),
            "end": end.isoformat(),
        }
    span_days = (end - start).days + 1
    classification = _period_class(span_days)
    return {
        "available": True,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "label": label,
        "days_requested": span_days,
        "classification": classification,
        "notes": notes,
        "era5_lag_days": ERA5_LAG_DAYS,
    }


def _period_class(days: int) -> str:
    if days < 90:
        return "short_term_anomaly"
    if days < 400:
        return "seasonal_or_annual_comparison"
    return "multi_year_record"
    # 20+ years would be long_term_trend — MAX_HISTORICAL_YEARS is 10, so we never claim that.


def _nums(rows: list[dict[str, Any]], key: str) -> list[float]:
    out: list[float] = []
    for row in rows:
        val = row.get(key)
        if val is None:
            continue
        try:
            out.append(float(val))
        except (TypeError, ValueError):
            continue
    return out


def _mean(values: list[float]) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def summarize_daily(rows: list[dict[str, Any]]) -> dict[str, Any]:
    precip = _nums(rows, "precipitation_mm")
    tmax = _nums(rows, "temp_max_c")
    tmin = _nums(rows, "temp_min_c")
    tmean = _nums(rows, "mean_temp_c")
    wind = _nums(rows, "wind_speed_max_kmh")
    rainy_th = threshold("rainy_day_mm")
    heavy_th = threshold("heavy_rain_24h_mm")
    very_heavy_th = threshold("very_heavy_rain_24h_mm")
    hot_th = threshold("heat_watch_c")
    very_hot_th = threshold("very_hot_c")

    missing = 0
    if rows:
        # days with neither precip nor temp
        for row in rows:
            if row.get("precipitation_mm") is None and row.get("mean_temp_c") is None:
                missing += 1

    max_daily_rain = max(precip) if precip else None
    max_rain_date = None
    if max_daily_rain is not None:
        for row in rows:
            try:
                if row.get("precipitation_mm") is not None and float(row["precipitation_mm"]) == max_daily_rain:
                    max_rain_date = row.get("date")
                    break
            except (TypeError, ValueError):
                continue

    return {
        "days_with_data": len(rows),
        "missing_days_in_payload": missing,
        "incomplete": missing > 0,
        "total_rainfall_mm": round(sum(precip), 1) if precip else None,
        "average_daily_rainfall_mm": _mean(precip),
        "maximum_daily_rainfall_mm": round(max_daily_rain, 1) if max_daily_rain is not None else None,
        "maximum_daily_rainfall_date": max_rain_date,
        "rainy_days": sum(1 for p in precip if p >= rainy_th) if precip else None,
        "extreme_rainfall_days": sum(1 for p in precip if p >= heavy_th) if precip else None,
        "very_heavy_rainfall_days": sum(1 for p in precip if p >= very_heavy_th) if precip else None,
        "average_temperature_c": _mean(tmean) if tmean else _mean(tmax),
        "maximum_temperature_c": round(max(tmax), 1) if tmax else None,
        "minimum_temperature_c": round(min(tmin), 1) if tmin else None,
        "hot_days": sum(1 for t in tmax if t >= hot_th) if tmax else None,
        "very_hot_days": sum(1 for t in tmax if t >= very_hot_th) if tmax else None,
        "maximum_wind_kmh": round(max(wind), 1) if wind else None,
        "thresholds": {
            "rainy_day_mm": rainy_th,
            "extreme_rainfall_day_mm": heavy_th,
            "very_heavy_rainfall_day_mm": very_heavy_th,
            "hot_day_c": hot_th,
            "very_hot_day_c": very_hot_th,
            "label": SCREENING_NOTE,
        },
    }


def monthly_series(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = {}
    for row in rows:
        day = str(row.get("date") or "")[:7]
        if len(day) < 7:
            continue
        bucket = buckets.setdefault(day, {"t": day, "rain": [], "temp": []})
        if row.get("precipitation_mm") is not None:
            try:
                bucket["rain"].append(float(row["precipitation_mm"]))
            except (TypeError, ValueError):
                pass
        if row.get("mean_temp_c") is not None:
            try:
                bucket["temp"].append(float(row["mean_temp_c"]))
            except (TypeError, ValueError):
                pass
    series = []
    for key in sorted(buckets):
        b = buckets[key]
        series.append(
            {
                "t": key,
                "rainfall_mm": round(sum(b["rain"]), 1) if b["rain"] else None,
                "mean_temp_c": round(sum(b["temp"]) / len(b["temp"]), 2) if b["temp"] else None,
            }
        )
    return series


def same_calendar_window_baseline(
    latitude: float,
    longitude: float,
    period_start: date,
    period_end: date,
    lookback_years: int = 5,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Mean of the same calendar window over previous years (excludes the requested window)."""
    windows: list[dict[str, Any]] = []
    for years_back in range(1, lookback_years + 1):
        try:
            ws = period_start.replace(year=period_start.year - years_back)
            we = period_end.replace(year=period_end.year - years_back)
        except ValueError:
            # 29 Feb
            ws = period_start.replace(year=period_start.year - years_back, day=28)
            we = period_end.replace(year=period_end.year - years_back, day=min(period_end.day, 28))
        bundle = fetch_historical_daily(
            latitude, longitude, ws.isoformat(), we.isoformat(), use_cache=use_cache
        )
        if not bundle.get("available"):
            continue
        stats = summarize_daily(bundle.get("daily") or [])
        windows.append({"start": ws.isoformat(), "end": we.isoformat(), "metrics": stats})
    if not windows:
        return {"available": False, "note": "Could not retrieve a historical baseline window."}
    rains = [w["metrics"]["total_rainfall_mm"] for w in windows if w["metrics"].get("total_rainfall_mm") is not None]
    temps = [
        w["metrics"]["average_temperature_c"]
        for w in windows
        if w["metrics"].get("average_temperature_c") is not None
    ]
    max_rains = [
        w["metrics"]["maximum_daily_rainfall_mm"]
        for w in windows
        if w["metrics"].get("maximum_daily_rainfall_mm") is not None
    ]
    return {
        "available": True,
        "lookback_years": lookback_years,
        "windows_used": len(windows),
        "average_rainfall_mm": _mean(rains),
        "average_temperature_c": _mean(temps),
        "maximum_daily_rainfall_mm": round(max(max_rains), 1) if max_rains else None,
        "note": (
            "Baseline is the same calendar window in previous years from ERA5 reanalysis. "
            "This is a seasonal comparison, not a climate-change trend."
        ),
    }


def classify_departure(kind: str, period_class: str, difference: Optional[float]) -> Optional[str]:
    if difference is None:
        return None
    if period_class == "short_term_anomaly":
        scale = "short-term anomaly"
    elif period_class == "seasonal_or_annual_comparison":
        scale = "seasonal/annual comparison"
    else:
        scale = "multi-year record comparison (not a long-term climate trend; <20 years)"
    return f"{kind} difference {difference:+} vs baseline ({scale})."


def analyze_location(
    latitude: float,
    longitude: float,
    start: str,
    end: str,
    location_name: Optional[str] = None,
    include_baseline: bool = True,
    use_cache: bool = True,
) -> dict[str, Any]:
    bundle = fetch_historical_daily(latitude, longitude, start, end, use_cache=use_cache)
    if not bundle.get("available"):
        return {
            "available": False,
            "location": location_name,
            "latitude": latitude,
            "longitude": longitude,
            "period": {"start": start, "end": end},
            "error": bundle.get("error") or "Historical range unavailable.",
            "detail": bundle.get("detail"),
        }
    rows = bundle.get("daily") or []
    stats = summarize_daily(rows)
    start_d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    expected_days = (end_d - start_d).days + 1
    incomplete = stats["days_with_data"] < expected_days * 0.95
    stats["incomplete"] = incomplete or stats.get("incomplete")
    stats["days_requested"] = expected_days
    baseline = None
    if include_baseline and expected_days < 400:
        baseline = same_calendar_window_baseline(
            latitude, longitude, start_d, end_d, use_cache=use_cache
        )
    elif include_baseline:
        baseline = {
            "available": False,
            "note": (
                "Same-calendar-window baseline is not computed for multi-year requested "
                "periods because shifted windows would overlap the sample. Treat these "
                "metrics as a multi-year record, not a climate-change trend."
            ),
        }
    rain_diff = None
    temp_diff = None
    if baseline and baseline.get("available"):
        if stats.get("total_rainfall_mm") is not None and baseline.get("average_rainfall_mm") is not None:
            rain_diff = round(stats["total_rainfall_mm"] - baseline["average_rainfall_mm"], 1)
        if stats.get("average_temperature_c") is not None and baseline.get("average_temperature_c") is not None:
            temp_diff = round(stats["average_temperature_c"] - baseline["average_temperature_c"], 2)
    span_days = expected_days
    return {
        "available": True,
        "location": location_name,
        "latitude": bundle.get("latitude", latitude),
        "longitude": bundle.get("longitude", longitude),
        "period": {"start": start, "end": end},
        "source": bundle.get("source"),
        "dataset": bundle.get("dataset"),
        "metrics": stats,
        "baseline": baseline,
        "departures": {
            "rainfall_mm": rain_diff,
            "temperature_c": temp_diff,
            "rainfall_text": classify_departure("Rainfall", _period_class(span_days), rain_diff),
            "temperature_text": classify_departure("Temperature", _period_class(span_days), temp_diff),
        },
        "charts": {
            "rainfall_over_time": monthly_series(rows),
            "temperature_over_time": monthly_series(rows),
        },
        "disclaimer": (
            "ERA5 reanalysis via Open-Meteo. Not station observations, not an official "
            "climate-change assessment, and not an official warning."
        ),
    }


def compare_locations(
    places: list[dict[str, Any]],
    start: str,
    end: str,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Same date range and variables for every city. Skip cities that fail; never invent."""
    results = []
    for place in places:
        item = analyze_location(
            latitude=place["latitude"],
            longitude=place["longitude"],
            start=start,
            end=end,
            location_name=place.get("name"),
            include_baseline=False,
            use_cache=use_cache,
        )
        results.append(item)
    available = [r for r in results if r.get("available")]
    comparison_rows = []
    for r in available:
        m = r.get("metrics") or {}
        comparison_rows.append(
            {
                "location": r.get("location"),
                "total_rainfall_mm": m.get("total_rainfall_mm"),
                "average_temperature_c": m.get("average_temperature_c"),
                "maximum_daily_rainfall_mm": m.get("maximum_daily_rainfall_mm"),
                "extreme_rainfall_days": m.get("extreme_rainfall_days"),
                "rainy_days": m.get("rainy_days"),
                "hot_days": m.get("hot_days"),
                "maximum_temperature_c": m.get("maximum_temperature_c"),
                "minimum_temperature_c": m.get("minimum_temperature_c"),
            }
        )
    wettest = None
    if comparison_rows and all(r.get("total_rainfall_mm") is not None for r in comparison_rows):
        wettest = max(comparison_rows, key=lambda r: r["total_rainfall_mm"])
    return {
        "available": bool(available),
        "period": {"start": start, "end": end},
        "locations": results,
        "comparison": comparison_rows,
        "wettest_location": wettest,
        "charts": {"city_rainfall_comparison": comparison_rows},
        "note": "All cities use the same date range and daily variables. Failed cities are omitted, not filled.",
        "disclaimer": (
            "ERA5 reanalysis via Open-Meteo. Extreme-day counts use WeatherGPT screening "
            "thresholds, not official warnings. This is not a flood prediction."
        ),
    }


def resolve_named_places(names: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    found: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    for name in names:
        place = search_location(name)
        if not place or place.get("error") or place.get("latitude") is None:
            failed.append({"name": name, "error": (place or {}).get("error") or "Location not found"})
            continue
        found.append(
            {
                "name": place.get("name") or name,
                "latitude": place["latitude"],
                "longitude": place["longitude"],
            }
        )
    return found, failed


def wants_nwp_verification(text: str) -> bool:
    return bool(
        re.search(
            r"\b(gfs|ecmwf|how accurate|forecast\s+error|verification|"
            r"predicted vs|previous.?run|model skill)\b",
            text or "",
            re.I,
        )
    )


def run_historical_query(
    message: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    location_name: Optional[str] = None,
    include_verification: Optional[bool] = None,
    use_cache: bool = True,
) -> dict[str, Any]:
    """End-to-end historical analysis for chat/API. Summaries only — no raw hourly to the LLM."""
    from app.services.entities import extract_place_names
    from app.services.nwp_verification import verify_models

    period = parse_period(message)
    if not period.get("available"):
        return {
            "available": False,
            "error": period.get("error") or "Requested historical range is unavailable.",
            "period": period,
        }

    names = extract_place_names(message)
    if location_name and location_name.split(",")[0].strip() not in names:
        # keep explicit GPS/name even if not in the known-city list
        pass
    places: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    if names:
        places, failed = resolve_named_places(names)
    if not places and latitude is not None and longitude is not None:
        places = [
            {
                "name": location_name or "Selected location",
                "latitude": latitude,
                "longitude": longitude,
            }
        ]
    if not places:
        return {
            "available": False,
            "error": "Location not resolved. Do not guess a place for historical analysis.",
            "failed_locations": failed,
            "period": {"start": period["start"], "end": period["end"], "label": period.get("label")},
        }

    do_verify = (
        include_verification
        if include_verification is not None
        else wants_nwp_verification(message)
    )

    if len(places) == 1:
        analysis = analyze_location(
            places[0]["latitude"],
            places[0]["longitude"],
            period["start"],
            period["end"],
            location_name=places[0]["name"],
            include_baseline=True,
            use_cache=use_cache,
        )
        payload: dict[str, Any] = {
            "available": analysis.get("available"),
            "mode": "single_location",
            "period": {
                "start": period["start"],
                "end": period["end"],
                "label": period.get("label"),
                "classification": period.get("classification"),
                "notes": period.get("notes") or [],
            },
            "location": analysis.get("location"),
            "metrics": analysis.get("metrics"),
            "baseline": analysis.get("baseline"),
            "departures": analysis.get("departures"),
            "charts": analysis.get("charts"),
            "source": analysis.get("source"),
            "dataset": analysis.get("dataset"),
            "disclaimer": analysis.get("disclaimer"),
            "error": analysis.get("error"),
            "failed_locations": failed,
        }
        if do_verify and analysis.get("available"):
            payload["nwp_verification"] = verify_models(
                places[0]["latitude"],
                places[0]["longitude"],
                period["start"],
                period["end"],
                location_name=places[0]["name"],
                use_cache=use_cache,
            )
            charts = dict(payload.get("charts") or {})
            nv = payload["nwp_verification"]
            charts.update(nv.get("charts") or {})
            payload["charts"] = charts
        return payload

    compared = compare_locations(places, period["start"], period["end"], use_cache=use_cache)
    payload = {
        "available": compared.get("available"),
        "mode": "multi_city",
        "period": {
            "start": period["start"],
            "end": period["end"],
            "label": period.get("label"),
            "classification": period.get("classification"),
            "notes": period.get("notes") or [],
        },
        "comparison": compared.get("comparison"),
        "wettest_location": compared.get("wettest_location"),
        "locations": [
            {
                "location": loc.get("location"),
                "metrics": loc.get("metrics"),
                "available": loc.get("available"),
                "error": loc.get("error"),
            }
            for loc in (compared.get("locations") or [])
        ],
        "charts": compared.get("charts"),
        "failed_locations": failed,
        "disclaimer": compared.get("disclaimer"),
    }
    if do_verify and places:
        payload["nwp_verification"] = verify_models(
            places[0]["latitude"],
            places[0]["longitude"],
            period["start"],
            period["end"],
            location_name=places[0]["name"],
            use_cache=use_cache,
        )
    return payload


def format_historical_context_block(result: dict[str, Any]) -> str:
    import json

    if not result.get("available"):
        return (
            "[HISTORICAL / CLIMATE ANALYSIS UNAVAILABLE]\n"
            f"{result.get('error')}\n"
            "Do NOT invent rainfall totals, temperatures, extremes, or NWP verification scores."
        )
    compact = {
        "mode": result.get("mode"),
        "period": result.get("period"),
        "location": result.get("location"),
        "metrics": result.get("metrics"),
        "baseline": result.get("baseline"),
        "departures": result.get("departures"),
        "comparison": result.get("comparison"),
        "wettest_location": result.get("wettest_location"),
        "locations": result.get("locations"),
        "nwp_verification_summary": _compact_verification(result.get("nwp_verification")),
        "disclaimer": result.get("disclaimer"),
    }
    return (
        "[HISTORICAL / CLIMATE ANALYSIS — ERA5 reanalysis numbers only]\n"
        "Explain these facts. Do NOT invent values. Do NOT call a short period a climate trend. "
        "Do NOT claim flooding or that one NWP model is always better. "
        "Extreme-day counts use WeatherGPT screening thresholds, not official warnings. "
        "If nwp_verification is present, treat skill as this location/period only.\n"
        + json.dumps(compact, ensure_ascii=False, default=str)
    )


def _compact_verification(block: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not block:
        return None
    if not block.get("available"):
        return {"available": False, "error": block.get("error")}
    gfs = block.get("gfs") or {}
    ecm = block.get("ecmwf") or {}
    return {
        "available": True,
        "period": block.get("period"),
        "lead_time": block.get("lead_time"),
        "gfs_rainfall": gfs.get("rainfall") if gfs.get("available") else {"available": False, "error": gfs.get("error")},
        "ecmwf_rainfall": ecm.get("rainfall") if ecm.get("available") else {"available": False, "error": ecm.get("error")},
        "comparison": block.get("comparison"),
        "disclaimer": block.get("disclaimer"),
    }


def nwp_vs_archive_context(
    latitude: float,
    longitude: float,
    location_name: Optional[str],
    nwp_rain_mm: Optional[float],
    nwp_max_temp_c: Optional[float],
    use_cache: bool = True,
) -> dict[str, Any]:
    """Same-month ERA5 baseline for Flood & Disaster. Does not recompute NWP severity."""
    today = date.today()
    end = archive_end_date(today)
    start = date(end.year - 5, end.month, 1)
    # current calendar month across last 5 years
    bundle = fetch_historical_daily(
        latitude, longitude, start.isoformat(), end.isoformat(), use_cache=use_cache
    )
    if not bundle.get("available"):
        return {
            "available": False,
            "error": bundle.get("error"),
            "note": "Live archive baseline unavailable; not fabricated.",
        }
    month = today.month
    same_month = [
        row
        for row in (bundle.get("daily") or [])
        if str(row.get("date") or "")[5:7] == f"{month:02d}"
    ]
    stats = summarize_daily(same_month)
    rain_base = stats.get("average_daily_rainfall_mm")
    # typical 24h is closer to mean daily; also report max daily in month
    comparison = None
    if nwp_rain_mm is not None and rain_base is not None:
        comparison = {
            "nwp_forecast_24h_mm": nwp_rain_mm,
            "historical_mean_daily_mm_same_month": rain_base,
            "historical_max_daily_mm_same_month": stats.get("maximum_daily_rainfall_mm"),
            "difference_vs_mean_daily_mm": round(nwp_rain_mm - rain_base, 1),
            "text": (
                f"The forecast rainfall is {nwp_rain_mm} mm / 24h versus a historical "
                f"mean daily rainfall of {rain_base} mm in this month over the last 5 years "
                f"(ERA5). Maximum daily in that sample: {stats.get('maximum_daily_rainfall_mm')} mm. "
                "This is not a flood prediction."
            ),
        }
    heat = None
    if nwp_max_temp_c is not None and stats.get("average_temperature_c") is not None:
        heat = {
            "nwp_max_c": nwp_max_temp_c,
            "historical_mean_c": stats.get("average_temperature_c"),
            "difference_c": round(nwp_max_temp_c - stats["average_temperature_c"], 1),
        }
    return {
        "available": True,
        "source": "open_meteo_historical_archive",
        "month": month,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "same_month_metrics": {
            "average_daily_rainfall_mm": stats.get("average_daily_rainfall_mm"),
            "maximum_daily_rainfall_mm": stats.get("maximum_daily_rainfall_mm"),
            "extreme_rainfall_days": stats.get("extreme_rainfall_days"),
            "average_temperature_c": stats.get("average_temperature_c"),
        },
        "nwp_vs_rainfall_baseline": comparison,
        "nwp_vs_temperature_baseline": heat,
        "thresholds_note": SCREENING_NOTE,
    }
