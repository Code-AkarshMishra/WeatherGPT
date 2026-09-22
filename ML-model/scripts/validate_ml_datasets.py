#!/usr/bin/env python3
"""Validate raw Open-Meteo NWP + GHCN downloads (including chunked runs) and report overlap."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = Path(__file__).resolve().parent
for p in (str(SCRIPTS_DIR), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from ml_data_pipeline import PREVIOUS_RUNS_COMMON_START, RAW_ROOT, write_json  # noqa: E402


NWP_VALUE_FIELDS = [
    "precipitation",
    "rain",
    "temperature_2m",
    "relative_humidity_2m",
    "pressure_msl",
    "surface_pressure",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "cape",
    "precipitation_probability",
]


def _iter_csv_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    files = list(directory.rglob("*.csv"))
    return sorted([p for p in files if p.is_file()], key=lambda p: p.stat().st_mtime, reverse=True)


def analyze_csv_files(
    paths: Iterable[Path],
    date_fields: list[str],
    value_fields: list[str],
) -> dict[str, Any]:
    paths = list(paths)
    rows = 0
    dates: list[str] = []
    lats: list[float] = []
    lons: list[float] = []
    stations: set[str] = set()
    models: Counter[str] = Counter()
    missing = Counter()
    present = Counter()
    seen_keys: set[tuple] = set()
    duplicates = 0
    columns: set[str] = set()
    problems: list[str] = []

    for path in paths:
        with open(path, encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames:
                columns.update(reader.fieldnames)
            for rec in reader:
                rows += 1
                for df in date_fields:
                    if rec.get(df):
                        dates.append(rec[df][:10])
                        break
                if rec.get("latitude"):
                    try:
                        lats.append(float(rec["latitude"]))
                        lons.append(float(rec["longitude"]))
                    except ValueError:
                        problems.append(f"bad lat/lon in {path.name}")
                if rec.get("station_id"):
                    stations.add(rec["station_id"])
                if rec.get("model"):
                    models[rec["model"]] += 1

                key_parts = (
                    rec.get("model"),
                    rec.get("station_id"),
                    rec.get("valid_time") or rec.get("date"),
                    rec.get("issue_time"),
                    rec.get("lead_time_hours"),
                    rec.get("element"),
                    rec.get("latitude"),
                    rec.get("longitude"),
                )
                if key_parts in seen_keys:
                    duplicates += 1
                else:
                    seen_keys.add(key_parts)

                for vf in value_fields:
                    if vf not in (reader.fieldnames or []):
                        continue
                    val = rec.get(vf)
                    if val is None or val == "":
                        missing[vf] += 1
                    else:
                        present[vf] += 1

    # Unique grid points
    grid_points = len({(round(a, 4), round(b, 4)) for a, b in zip(lats, lons)}) if lats else 0
    miss_pct = {
        k: round(100.0 * missing[k] / rows, 2) if rows else None
        for k in set(list(missing) + list(present))
    }
    return {
        "file_count": len(paths),
        "files_sample": [str(p) for p in paths[:10]],
        "rows": rows,
        "columns": sorted(columns),
        "date_min": min(dates) if dates else None,
        "date_max": max(dates) if dates else None,
        "stations": len(stations),
        "station_ids_sample": sorted(stations)[:30],
        "nwp_grid_points": grid_points,
        "models": dict(models),
        "lat_min": min(lats) if lats else None,
        "lat_max": max(lats) if lats else None,
        "lon_min": min(lons) if lons else None,
        "lon_max": max(lons) if lons else None,
        "duplicates": duplicates,
        "missing_value_pct": miss_pct,
        "available_value_fields": [c for c in value_fields if c in columns],
        "problems_sample": problems[:20],
    }


def overlap(a_min: Optional[str], a_max: Optional[str], b_min: Optional[str], b_max: Optional[str]) -> dict[str, Any]:
    if not all([a_min, a_max, b_min, b_max]):
        return {"available": False, "reason": "missing date bounds"}
    start = max(a_min, b_min)  # type: ignore[arg-type]
    end = min(a_max, b_max)  # type: ignore[arg-type]
    if start > end:
        return {"available": False, "reason": "no overlapping dates", "start": start, "end": end}
    return {"available": True, "start": start, "end": end}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate ML raw datasets and report coverage.")
    parser.add_argument("--run-id", type=str, default=None, help="Validate a specific NWP chunk run_id")
    args = parser.parse_args()

    gfs_dir = RAW_ROOT / "open_meteo" / "gfs"
    ecm_dir = RAW_ROOT / "open_meteo" / "ecmwf"
    if args.run_id:
        gfs_files = _iter_csv_files(gfs_dir / "chunks" / args.run_id)
        ecm_files = _iter_csv_files(ecm_dir / "chunks" / args.run_id)
    else:
        # Prefer newest chunk run if present
        gfs_chunk_runs = sorted((gfs_dir / "chunks").glob("*")) if (gfs_dir / "chunks").exists() else []
        ecm_chunk_runs = sorted((ecm_dir / "chunks").glob("*")) if (ecm_dir / "chunks").exists() else []
        if gfs_chunk_runs:
            gfs_files = _iter_csv_files(gfs_chunk_runs[-1])
        else:
            gfs_files = [p for p in _iter_csv_files(gfs_dir) if "chunks" not in p.parts]
        if ecm_chunk_runs:
            ecm_files = _iter_csv_files(ecm_chunk_runs[-1])
        else:
            ecm_files = [p for p in _iter_csv_files(ecm_dir) if "chunks" not in p.parts]

    ghcn_files = sorted(
        (RAW_ROOT / "ghcn").glob("ghcn_*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )[:1]

    report: dict[str, Any] = {
        "documented_previous_runs_common_start": PREVIOUS_RUNS_COMMON_START,
        "file_counts": {
            "gfs_csv_files": len(gfs_files),
            "ecmwf_csv_files": len(ecm_files),
            "ghcn_combined_csv_files": len(list((RAW_ROOT / "ghcn").glob("ghcn_*.csv"))),
            "ghcn_station_files": len(list((RAW_ROOT / "ghcn" / "by_station").glob("*.csv*")))
            if (RAW_ROOT / "ghcn" / "by_station").exists()
            else 0,
        },
    }

    report["gfs"] = (
        analyze_csv_files(gfs_files, ["valid_time", "issue_time"], NWP_VALUE_FIELDS)
        if gfs_files
        else {"available": False, "error": "No GFS CSV found"}
    )
    report["ecmwf"] = (
        analyze_csv_files(ecm_files, ["valid_time", "issue_time"], NWP_VALUE_FIELDS)
        if ecm_files
        else {"available": False, "error": "No ECMWF CSV found"}
    )
    report["ghcn"] = (
        analyze_csv_files(ghcn_files, ["date"], ["value", "value_raw"])
        if ghcn_files
        else {"available": False, "error": "No GHCN CSV found"}
    )

    gfs = report.get("gfs") or {}
    ecm = report.get("ecmwf") or {}
    ghcn = report.get("ghcn") or {}
    gfs_ecm = overlap(gfs.get("date_min"), gfs.get("date_max"), ecm.get("date_min"), ecm.get("date_max"))
    all_three = overlap(
        gfs_ecm.get("start") if gfs_ecm.get("available") else None,
        gfs_ecm.get("end") if gfs_ecm.get("available") else None,
        ghcn.get("date_min"),
        ghcn.get("date_max"),
    )
    report["overlap"] = {
        "gfs_ecmwf": gfs_ecm,
        "gfs_ecmwf_ghcn": all_three,
        "ml_training_status": "RAW_ACQUISITION_ONLY",
    }

    out = RAW_ROOT / "validation_report.json"
    write_json(out, report)
    print(json.dumps(report, indent=2))
    print(f"\nValidation report written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
