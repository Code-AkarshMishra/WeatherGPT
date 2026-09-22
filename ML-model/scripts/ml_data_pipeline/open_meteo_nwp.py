"""Open-Meteo Previous Runs downloader with explicit issue/valid/lead times.

Uses https://previous-runs-api.open-meteo.com/v1/forecast

For each previous_day{N} variable:
  valid_time  = hourly.time
  issue_time  = valid_time - N days
  lead_time_hours = N * 24

This preserves forecast-run identity needed to avoid temporal leakage.
No synthetic or mock weather values are created.
"""
from __future__ import annotations

import csv
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

from ml_data_pipeline import (
    MODEL_IDS,
    NWP_BASE_VARS,
    NWP_UNITS,
    PREVIOUS_RUNS_COMMON_START,
    PREVIOUS_RUNS_URL,
    RAW_ROOT,
    write_metadata,
)


def hourly_var_names(base_vars: list[str], lead_days: list[int]) -> list[str]:
    names: list[str] = []
    for day in lead_days:
        for var in base_vars:
            names.append(f"{var}_previous_day{day}")
    return names


def _parse_iso(ts: str) -> datetime:
    # Open-Meteo returns "YYYY-MM-DDTHH:MM" (local/auto) or with Z
    if ts.endswith("Z"):
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if "+" in ts[10:] or ts.count("-") > 2:
        return datetime.fromisoformat(ts)
    return datetime.fromisoformat(ts)


def rows_from_previous_runs_payload(
    payload: dict[str, Any],
    *,
    model_key: str,
    model_id: str,
    latitude: float,
    longitude: float,
    lead_days: list[int],
    base_vars: list[str],
    request_url: str,
) -> list[dict[str, Any]]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    rows: list[dict[str, Any]] = []

    for i, valid_ts in enumerate(times):
        valid_dt = _parse_iso(valid_ts)
        for day in lead_days:
            issue_dt = valid_dt - timedelta(days=day)
            row: dict[str, Any] = {
                "latitude": latitude,
                "longitude": longitude,
                "model": model_key,
                "open_meteo_model_id": model_id,
                "valid_time": valid_dt.isoformat(sep="T", timespec="minutes"),
                "issue_time": issue_dt.isoformat(sep="T", timespec="minutes"),
                "lead_time_hours": day * 24,
                "lead_time_label": f"previous_day{day}",
                "source": "open_meteo_previous_runs",
                "endpoint": PREVIOUS_RUNS_URL,
                "timezone": payload.get("timezone"),
                "elevation_m": payload.get("elevation"),
            }
            for var in base_vars:
                key = f"{var}_previous_day{day}"
                series = hourly.get(key) or []
                value = series[i] if i < len(series) else None
                row[var] = value
                row[f"{var}_unit"] = NWP_UNITS.get(var)
            row["request_url"] = request_url
            rows.append(row)
    return rows


def fetch_previous_runs(
    client: httpx.Client,
    *,
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
    model_key: str,
    lead_days: list[int],
    base_vars: list[str],
    timezone: str = "UTC",
    retries: int = 3,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    model_id = MODEL_IDS[model_key]
    # Prefer full requested set; drop optional fields if the API rejects them.
    attempt_var_sets = [list(base_vars)]
    optional = {"cape", "wind_gusts_10m", "precipitation_probability", "relative_humidity_2m", "surface_pressure"}
    trimmed = [v for v in base_vars if v not in optional]
    if trimmed != base_vars:
        attempt_var_sets.append(trimmed)
    core = [
        v
        for v in [
            "precipitation",
            "rain",
            "temperature_2m",
            "pressure_msl",
            "wind_speed_10m",
            "wind_direction_10m",
        ]
        if v in base_vars
    ]
    if core and core not in attempt_var_sets:
        attempt_var_sets.append(core)

    last_err: Optional[Exception] = None
    for vars_try in attempt_var_sets:
        hourly = ",".join(hourly_var_names(vars_try, lead_days))
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": hourly,
            "models": model_id,
            "timezone": timezone,
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "temperature_unit": "celsius",
        }
        request_url = f"{PREVIOUS_RUNS_URL}?{urlencode(params)}"
        for attempt in range(retries):
            try:
                response = client.get(PREVIOUS_RUNS_URL, params=params)
                if response.status_code == 429:
                    time.sleep(2 ** attempt)
                    continue
                if response.status_code >= 400:
                    # Try next variable set
                    last_err = RuntimeError(f"HTTP {response.status_code}: {response.text[:300]}")
                    break
                payload = response.json()
                if isinstance(payload, dict) and payload.get("error"):
                    last_err = RuntimeError(str(payload.get("reason") or payload.get("error")))
                    break
                rows = rows_from_previous_runs_payload(
                    payload,
                    model_key=model_key,
                    model_id=model_id,
                    latitude=latitude,
                    longitude=longitude,
                    lead_days=lead_days,
                    base_vars=vars_try,
                    request_url=request_url,
                )
                # Ensure all originally requested columns exist (null if unsupported)
                for row in rows:
                    for var in base_vars:
                        if var not in row:
                            row[var] = None
                            row[f"{var}_unit"] = NWP_UNITS.get(var)
                meta = {
                    "http_status": response.status_code,
                    "request_url": request_url,
                    "open_meteo_model_id": model_id,
                    "variables_used": vars_try,
                    "variables_requested": base_vars,
                    "returned_hourly_keys": sorted((payload.get("hourly") or {}).keys()),
                    "row_count": len(rows),
                }
                return rows, meta
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Previous Runs fetch failed for {model_key} @ {latitude},{longitude}: {last_err}")


def write_nwp_csv(path: Path, rows: list[dict[str, Any]], base_vars: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        # Still write header-only file for provenance of empty result
        fieldnames = [
            "latitude",
            "longitude",
            "model",
            "open_meteo_model_id",
            "valid_time",
            "issue_time",
            "lead_time_hours",
            "lead_time_label",
            "source",
            "endpoint",
            "timezone",
            "elevation_m",
            *base_vars,
            *[f"{v}_unit" for v in base_vars],
            "request_url",
        ]
        with open(path, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=fieldnames).writeheader()
        return

    fieldnames = list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def model_output_dir(model_key: str) -> Path:
    return RAW_ROOT / "open_meteo" / model_key


def iter_date_chunks(start_date: str, end_date: str, chunk_days: int) -> list[tuple[str, str]]:
    if chunk_days <= 0:
        return [(start_date, end_date)]
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    chunks: list[tuple[str, str]] = []
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=chunk_days - 1), end)
        chunks.append((cur.isoformat(), chunk_end.isoformat()))
        cur = chunk_end + timedelta(days=1)
    return chunks


def download_nwp_for_locations(
    locations: list[dict[str, float]],
    *,
    start_date: str,
    end_date: str,
    models: list[str],
    lead_days: list[int],
    base_vars: Optional[list[str]] = None,
    timeout: float = 90.0,
    sleep_s: float = 0.4,
    chunk_days: int = 31,
    run_id: Optional[str] = None,
    skip_existing_chunks: bool = True,
) -> dict[str, Any]:
    vars_ = base_vars or list(NWP_BASE_VARS)
    run_id = run_id or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    chunks = iter_date_chunks(start_date, end_date, chunk_days)
    summary: dict[str, Any] = {
        "endpoint": PREVIOUS_RUNS_URL,
        "start_date": start_date,
        "end_date": end_date,
        "lead_days": lead_days,
        "variables_requested": vars_,
        "location_count": len(locations),
        "locations": locations,
        "chunk_days": chunk_days,
        "chunks": chunks,
        "run_id": run_id,
        "skip_existing_chunks": skip_existing_chunks,
        "models": {},
        "availability_note": (
            f"Open-Meteo Previous Runs: most models from {PREVIOUS_RUNS_COMMON_START}; "
            "GFS temperature may extend earlier for some variables."
        ),
    }

    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for model_key in models:
            if model_key not in MODEL_IDS:
                raise ValueError(f"Unknown model '{model_key}'. Choose from {list(MODEL_IDS)}")
            out_dir = model_output_dir(model_key)
            chunk_dir = out_dir / "chunks" / run_id
            chunk_dir.mkdir(parents=True, exist_ok=True)
            total_rows = 0
            files: list[str] = []
            failures: list[dict[str, Any]] = []
            successes = 0
            skipped = 0

            rate_limit_hit = False
            for chunk_start, chunk_end in chunks:
                csv_path = (
                    chunk_dir
                    / f"{model_key}_{chunk_start}_{chunk_end}_lead{'-'.join(map(str, lead_days))}.csv"
                )
                n_days = (
                    date.fromisoformat(chunk_end) - date.fromisoformat(chunk_start)
                ).days + 1
                expected_rows = len(locations) * n_days * 24
                if skip_existing_chunks and csv_path.exists() and csv_path.stat().st_size > 0:
                    with open(csv_path, encoding="utf-8", errors="replace") as f:
                        existing_rows = max(0, sum(1 for _ in f) - 1)
                    # Only skip complete chunks; partial/empty files are re-fetched.
                    if existing_rows >= expected_rows:
                        total_rows += existing_rows
                        files.append(str(csv_path))
                        skipped += 1
                        print(
                            f"[{model_key}] SKIP existing {chunk_start}..{chunk_end}: "
                            f"{existing_rows} rows -> {csv_path.name}",
                            flush=True,
                        )
                        continue
                    print(
                        f"[{model_key}] REFETCH incomplete {chunk_start}..{chunk_end}: "
                        f"{existing_rows}/{expected_rows} rows",
                        flush=True,
                    )

                chunk_rows: list[dict[str, Any]] = []
                consecutive_rate_limits = 0
                for loc in locations:
                    lat, lon = loc["latitude"], loc["longitude"]
                    try:
                        rows, meta = fetch_previous_runs(
                            client,
                            latitude=lat,
                            longitude=lon,
                            start_date=chunk_start,
                            end_date=chunk_end,
                            model_key=model_key,
                            lead_days=lead_days,
                            base_vars=vars_,
                        )
                        chunk_rows.extend(rows)
                        successes += 1
                        consecutive_rate_limits = 0
                    except Exception as exc:  # noqa: BLE001
                        err_s = str(exc)
                        failures.append(
                            {
                                "latitude": lat,
                                "longitude": lon,
                                "chunk_start": chunk_start,
                                "chunk_end": chunk_end,
                                "error": err_s,
                            }
                        )
                        if "429" in err_s or "Daily API request limit" in err_s:
                            consecutive_rate_limits += 1
                            if consecutive_rate_limits >= 5:
                                rate_limit_hit = True
                                print(
                                    f"[{model_key}] ABORT: Open-Meteo daily API limit "
                                    f"(429) during {chunk_start}..{chunk_end}. "
                                    "Resume later; incomplete chunk not finalized.",
                                    flush=True,
                                )
                                break
                    time.sleep(sleep_s)

                if rate_limit_hit:
                    # Do not write a partial/empty chunk that would block a clean resume
                    # unless we already have a complete file; leave incomplete files as-is.
                    break

                write_nwp_csv(csv_path, chunk_rows, vars_)
                write_metadata(
                    csv_path.with_suffix(".metadata.json"),
                    source="Open-Meteo Previous Model Runs API",
                    api_endpoint=PREVIOUS_RUNS_URL,
                    documentation="https://open-meteo.com/en/docs/previous-runs-api",
                    model=model_key,
                    open_meteo_model_id=MODEL_IDS[model_key],
                    variables=vars_,
                    units=NWP_UNITS,
                    geographic_coverage={"location_count": len(locations)},
                    date_range={"start": chunk_start, "end": chunk_end},
                    lead_days=lead_days,
                    issue_time_definition=(
                        "issue_time = valid_time - lead_time_hours. "
                        "previous_dayN means the forecast value issued N days before valid_time."
                    ),
                    output_csv=str(csv_path),
                    row_count=len(chunk_rows),
                    run_id=run_id,
                    missing_value_policy="null/empty preserved; never imputed",
                )
                total_rows += len(chunk_rows)
                files.append(str(csv_path))
                print(
                    f"[{model_key}] {chunk_start}..{chunk_end}: {len(chunk_rows)} rows -> {csv_path.name}",
                    flush=True,
                )

            summary_meta = out_dir / f"{model_key}_{start_date}_{end_date}_{run_id}.summary.json"
            write_metadata(
                summary_meta,
                source="Open-Meteo Previous Model Runs API",
                api_endpoint=PREVIOUS_RUNS_URL,
                model=model_key,
                open_meteo_model_id=MODEL_IDS[model_key],
                variables=vars_,
                units=NWP_UNITS,
                date_range={"start": start_date, "end": end_date},
                lead_days=lead_days,
                location_count=len(locations),
                chunk_files=files,
                row_count=total_rows,
                request_successes=successes,
                request_failures=len(failures),
                chunks_skipped=skipped,
                failures_sample=failures[:50],
                run_id=run_id,
                rate_limit_abort=rate_limit_hit,
            )
            summary["models"][model_key] = {
                "summary_metadata": str(summary_meta),
                "chunk_dir": str(chunk_dir),
                "chunk_files": files,
                "row_count": total_rows,
                "file_count": len(files),
                "request_successes": successes,
                "request_failures": len(failures),
                "chunks_skipped": skipped,
                "rate_limit_abort": rate_limit_hit,
            }
    return summary
