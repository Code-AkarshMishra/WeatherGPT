"""Discover verified overlapping date range for GFS + ECMWF Previous Runs + GHCN."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import httpx

from ml_data_pipeline import (
    GHCN_INVENTORY_URL,
    GHCN_STATIONS_URL,
    MODEL_IDS,
    PREVIOUS_RUNS_COMMON_START,
    PREVIOUS_RUNS_URL,
    RAW_ROOT,
    grid_points_from_bbox,
    load_region_config,
    write_json,
    write_metadata,
)
from ml_data_pipeline.ghcn import (
    download_text,
    filter_stations,
    ghcn_dir,
    parse_inventory,
    parse_stations,
)


def _probe_previous_runs(
    client: httpx.Client,
    *,
    model_key: str,
    latitude: float,
    longitude: float,
    start: str,
    end: str,
) -> dict[str, Any]:
    model_id = MODEL_IDS[model_key]
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start,
        "end_date": end,
        "hourly": "precipitation_previous_day1,temperature_2m_previous_day1",
        "models": model_id,
        "timezone": "UTC",
    }
    response = client.get(PREVIOUS_RUNS_URL, params=params, timeout=60.0)
    if response.status_code >= 400:
        return {
            "ok": False,
            "model": model_key,
            "http_status": response.status_code,
            "error": response.text[:300],
        }
    payload = response.json()
    if isinstance(payload, dict) and payload.get("error"):
        return {
            "ok": False,
            "model": model_key,
            "error": str(payload.get("reason") or payload.get("error")),
        }
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    precip = hourly.get("precipitation_previous_day1") or []
    temp = hourly.get("temperature_2m_previous_day1") or []
    first_idx = None
    last_idx = None
    non_null = 0
    for i, ts in enumerate(times):
        p = precip[i] if i < len(precip) else None
        t = temp[i] if i < len(temp) else None
        if p is not None or t is not None:
            non_null += 1
            if first_idx is None:
                first_idx = i
            last_idx = i
    return {
        "ok": True,
        "model": model_key,
        "open_meteo_model_id": model_id,
        "probe_start": start,
        "probe_end": end,
        "hourly_count": len(times),
        "non_null_hours": non_null,
        "first_valid_time": times[first_idx] if first_idx is not None else None,
        "last_valid_time": times[last_idx] if last_idx is not None else None,
        "has_data": non_null > 0,
    }


def _month_starts(start: date, end: date) -> list[date]:
    months: list[date] = []
    cur = date(start.year, start.month, 1)
    while cur <= end:
        months.append(cur)
        if cur.month == 12:
            cur = date(cur.year + 1, 1, 1)
        else:
            cur = date(cur.year, cur.month + 1, 1)
    return months


def _month_end(d: date) -> date:
    if d.month == 12:
        return date(d.year, 12, 31)
    return date(d.year, d.month + 1, 1) - timedelta(days=1)


def find_first_non_null_month(
    client: httpx.Client,
    *,
    model_key: str,
    latitude: float,
    longitude: float,
    start: date,
    end: date,
) -> Optional[dict[str, Any]]:
    """Walk month-by-month to find first window with non-null previous_day1 fields."""
    for month_start in _month_starts(start, end):
        m_end = min(_month_end(month_start), end)
        # Probe first 5 days of each month for speed
        probe_end = min(month_start + timedelta(days=4), m_end)
        result = _probe_previous_runs(
            client,
            model_key=model_key,
            latitude=latitude,
            longitude=longitude,
            start=month_start.isoformat(),
            end=probe_end.isoformat(),
        )
        if result.get("has_data"):
            return {
                "first_month": month_start.isoformat(),
                "probe": result,
            }
    return None


def discover_overlap(
    config_path: Optional[Path] = None,
    *,
    probe_lat: Optional[float] = None,
    probe_lon: Optional[float] = None,
) -> dict[str, Any]:
    cfg = load_region_config(config_path)
    bbox = cfg["bbox"]
    points = grid_points_from_bbox(
        bbox["min_lat"],
        bbox["max_lat"],
        bbox["min_lon"],
        bbox["max_lon"],
        float((cfg.get("nwp_grid") or {}).get("step_deg") or 3.0),
    )
    if probe_lat is None or probe_lon is None:
        probe_lat = round((bbox["min_lat"] + bbox["max_lat"]) / 2, 2)
        probe_lon = round((bbox["min_lon"] + bbox["max_lon"]) / 2, 2)

    documented_start = date.fromisoformat(PREVIOUS_RUNS_COMMON_START)
    today = datetime.now(timezone.utc).date()
    documented_end = today - timedelta(days=2)

    late_start = (documented_end - timedelta(days=9)).isoformat()

    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        print("Scanning for first non-null GFS month...", flush=True)
        gfs_first = find_first_non_null_month(
            client,
            model_key="gfs",
            latitude=probe_lat,
            longitude=probe_lon,
            start=documented_start,
            end=documented_end,
        )
        print("Scanning for first non-null ECMWF month...", flush=True)
        ecm_first = find_first_non_null_month(
            client,
            model_key="ecmwf",
            latitude=probe_lat,
            longitude=probe_lon,
            start=documented_start,
            end=documented_end,
        )
        gfs_late = _probe_previous_runs(
            client,
            model_key="gfs",
            latitude=probe_lat,
            longitude=probe_lon,
            start=late_start,
            end=documented_end.isoformat(),
        )
        ecm_late = _probe_previous_runs(
            client,
            model_key="ecmwf",
            latitude=probe_lat,
            longitude=probe_lon,
            start=late_start,
            end=documented_end.isoformat(),
        )

        meta_dir = ghcn_dir() / "metadata"
        meta_dir.mkdir(parents=True, exist_ok=True)
        stations_path = download_text(client, GHCN_STATIONS_URL, meta_dir / "ghcnd-stations.txt")
        inventory_path = download_text(client, GHCN_INVENTORY_URL, meta_dir / "ghcnd-inventory.txt")
        stations = parse_stations(stations_path)
        inventory = parse_inventory(inventory_path)

        ghcn_cfg = cfg.get("ghcn") or {}
        use_bbox = ghcn_cfg.get("use_bbox", True)
        max_stations = ghcn_cfg.get("max_stations")
        selected = filter_stations(
            stations,
            inventory,
            countries=list(cfg.get("countries") or ["IN"]),
            bbox=bbox if use_bbox else None,
            elements=list(ghcn_cfg.get("elements") or ["PRCP"]),
            start_year=documented_start.year,
            end_year=documented_end.year,
            min_years_coverage=int(ghcn_cfg.get("min_years_coverage") or 1),
            max_stations=max_stations,
        )

    gfs_start = (gfs_first or {}).get("first_month")
    ecm_start = (ecm_first or {}).get("first_month")
    late_ok = bool(gfs_late.get("has_data") and ecm_late.get("has_data"))

    overlap_start = None
    overlap_end = None
    if gfs_start and ecm_start and late_ok:
        overlap_start = max(gfs_start, ecm_start)
        ends = [
            (gfs_late.get("last_valid_time") or "")[:10],
            (ecm_late.get("last_valid_time") or "")[:10],
            documented_end.isoformat(),
        ]
        ends = [e for e in ends if e]
        overlap_end = min(ends)

    report = {
        "probe_point": {"latitude": probe_lat, "longitude": probe_lon},
        "documented_previous_runs_common_start": PREVIOUS_RUNS_COMMON_START,
        "first_non_null": {
            "gfs": gfs_first,
            "ecmwf": ecm_first,
        },
        "probes": {
            "gfs_late": gfs_late,
            "ecmwf_late": ecm_late,
        },
        "nwp_grid_point_count": len(points),
        "nwp_grid_step_deg": float((cfg.get("nwp_grid") or {}).get("step_deg") or 3.0),
        "bbox": bbox,
        "ghcn_stations_matching_filter": len(selected),
        "ghcn_station_ids_sample": [s["station_id"] for s in selected[:30]],
        "verified_overlap": {
            "available": bool(overlap_start and overlap_end and selected),
            "start": overlap_start,
            "end": overlap_end,
            "basis": (
                "Month-by-month Previous Runs probes until first non-null GFS and ECMWF "
                "previous_day1 values; GHCN inventory filter for IN PRCP stations."
            ),
        },
        "limitations": [
            "API may accept dates from 2024-01-01 while returning all-null hours; "
            "verified start is the first month with non-null values at the probe point.",
            "Single Runs API is not used (GFS archive mostly from 2026-04).",
            "GHCN station density and PRCP reporting frequency vary; missing days stay missing.",
            "Some NWP variables (rain, CAPE, gusts, precip probability) may be null for a model.",
        ],
    }

    out = RAW_ROOT / "overlap_discovery.json"
    write_json(out, report)
    write_metadata(
        RAW_ROOT / "overlap_discovery.metadata.json",
        source="WeatherGPT ML overlap discovery",
        config=str(config_path) if config_path else "india_ml_v1 / default",
        report_path=str(out),
        **report["verified_overlap"],
    )
    return report
