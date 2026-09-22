#!/usr/bin/env python3
"""Download Open-Meteo historical NWP (GFS / ECMWF) via Previous Runs API.

Preserves issue_time, valid_time, and lead_time for each forecast value.
Does not train models or invent weather data.

Example:
  python scripts/download_nwp_data.py --config data/configs/india_north_pilot.json
  python scripts/download_nwp_data.py --start 2024-06-01 --end 2024-06-07 --models gfs,ecmwf --lead-days 1
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = Path(__file__).resolve().parent
for p in (str(SCRIPTS_DIR), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from ml_data_pipeline import (  # noqa: E402
    NWP_BASE_VARS,
    PREVIOUS_RUNS_COMMON_START,
    grid_points_from_bbox,
    load_region_config,
    parse_locations_arg,
    write_json,
)
from ml_data_pipeline.open_meteo_nwp import download_nwp_for_locations  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Download Open-Meteo Previous Runs NWP data (GFS/ECMWF).")
    parser.add_argument("--config", type=Path, default=None, help="Region JSON config")
    parser.add_argument("--start", type=str, default=None, help="Start date YYYY-MM-DD")
    parser.add_argument("--end", type=str, default=None, help="End date YYYY-MM-DD")
    parser.add_argument("--models", type=str, default="gfs,ecmwf", help="Comma list: gfs,ecmwf")
    parser.add_argument(
        "--lead-days",
        type=str,
        default="1",
        help="Comma list of previous_day offsets (1=24h lead). Example: 1,2,3",
    )
    parser.add_argument(
        "--locations",
        type=str,
        default=None,
        help="Optional explicit points: 'lat,lon;lat,lon' (overrides grid)",
    )
    parser.add_argument("--step-deg", type=float, default=None, help="Grid step degrees (overrides config)")
    parser.add_argument(
        "--variables",
        type=str,
        default=None,
        help=f"Comma list of base vars. Default: {','.join(NWP_BASE_VARS)}",
    )
    parser.add_argument("--max-locations", type=int, default=None, help="Cap number of grid/points")
    parser.add_argument("--chunk-days", type=int, default=None, help="Split downloads into N-day chunks")
    parser.add_argument("--sleep", type=float, default=0.4, help="Seconds between API calls")
    args = parser.parse_args()

    cfg = load_region_config(args.config)
    bbox = cfg["bbox"]
    dates = cfg.get("default_date_range") or {}
    start = args.start or dates.get("start") or PREVIOUS_RUNS_COMMON_START
    end = args.end or dates.get("end")
    if not end:
        raise SystemExit("--end is required (or set default_date_range.end in config)")

    if start < PREVIOUS_RUNS_COMMON_START:
        print(
            f"WARNING: start {start} is before documented Previous Runs common coverage "
            f"({PREVIOUS_RUNS_COMMON_START}). Some models/variables may be empty."
        )

    locations = parse_locations_arg(args.locations)
    if locations is None:
        step = args.step_deg
        if step is None:
            step = float((cfg.get("nwp_grid") or {}).get("step_deg") or 2.0)
        locations = grid_points_from_bbox(
            bbox["min_lat"], bbox["max_lat"], bbox["min_lon"], bbox["max_lon"], step
        )
    if args.max_locations is not None:
        locations = locations[: args.max_locations]

    models = [m.strip().lower() for m in args.models.split(",") if m.strip()]
    lead_days = sorted({int(x) for x in args.lead_days.split(",") if x.strip()})
    base_vars = (
        [v.strip() for v in args.variables.split(",") if v.strip()]
        if args.variables
        else list(NWP_BASE_VARS)
    )
    chunk_days = args.chunk_days if args.chunk_days is not None else int((cfg.get("nwp") or {}).get("chunk_days") or 31)

    print(f"Locations: {len(locations)}")
    print(f"Date range: {start} -> {end}")
    print(f"Models: {models}")
    print(f"Lead days: {lead_days}")
    print(f"Chunk days: {chunk_days}")
    print(f"Variables: {base_vars}")
    print("Endpoint: https://previous-runs-api.open-meteo.com/v1/forecast")

    summary = download_nwp_for_locations(
        locations,
        start_date=start,
        end_date=end,
        models=models,
        lead_days=lead_days,
        base_vars=base_vars,
        sleep_s=args.sleep,
        chunk_days=chunk_days,
    )

    summary_path = REPO_ROOT / "data" / "raw" / "open_meteo" / "last_nwp_download_summary.json"
    write_json(summary_path, summary)
    print(json.dumps(summary, indent=2))
    print(f"\nSummary written to {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
