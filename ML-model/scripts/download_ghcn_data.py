#!/usr/bin/env python3
"""Download NOAA GHCN-Daily observations for a configurable region/stations.

Filters stations via metadata/inventory; downloads only selected station CSVs.
Preserves MFLAG/QFLAG/SFLAG. Does not invent observations.

Example:
  python scripts/download_ghcn_data.py --config data/configs/india_north_pilot.json
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

from ml_data_pipeline import load_region_config, write_json  # noqa: E402
from ml_data_pipeline.ghcn import download_ghcn  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Download NOAA GHCN-Daily (filtered stations).")
    parser.add_argument("--config", type=Path, default=None)
    parser.add_argument("--start", type=str, default=None)
    parser.add_argument("--end", type=str, default=None)
    parser.add_argument("--countries", type=str, default=None, help="Comma FIPS codes, e.g. IN")
    parser.add_argument("--elements", type=str, default="PRCP", help="Comma GHCN elements")
    parser.add_argument("--max-stations", type=int, default=None)
    parser.add_argument("--min-years-coverage", type=int, default=None)
    parser.add_argument("--force-refresh-meta", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.3)
    parser.add_argument(
        "--no-bbox",
        action="store_true",
        help="Ignore bbox from config (country-only filter)",
    )
    args = parser.parse_args()

    cfg = load_region_config(args.config)
    dates = cfg.get("default_date_range") or {}
    ghcn_cfg = cfg.get("ghcn") or {}
    start = args.start or dates.get("start")
    end = args.end or dates.get("end")
    if not start or not end:
        raise SystemExit("--start and --end are required (or set in config)")

    countries = (
        [c.strip().upper() for c in args.countries.split(",") if c.strip()]
        if args.countries
        else list(cfg.get("countries") or ["IN"])
    )
    elements = [e.strip().upper() for e in args.elements.split(",") if e.strip()]
    max_stations = args.max_stations if args.max_stations is not None else int(ghcn_cfg.get("max_stations") or 25)
    min_years = (
        args.min_years_coverage
        if args.min_years_coverage is not None
        else int(ghcn_cfg.get("min_years_coverage") or 1)
    )
    bbox = None if args.no_bbox else cfg.get("bbox")

    print(f"Countries: {countries}")
    print(f"BBox: {bbox}")
    print(f"Elements: {elements}")
    print(f"Date range: {start} -> {end}")
    print(f"Max stations: {max_stations}")

    result = download_ghcn(
        countries=countries,
        bbox=bbox,
        elements=elements,
        start_date=start,
        end_date=end,
        min_years_coverage=min_years,
        max_stations=max_stations,
        sleep_s=args.sleep,
        force_refresh_meta=args.force_refresh_meta,
    )

    summary_path = REPO_ROOT / "data" / "raw" / "ghcn" / "last_ghcn_download_summary.json"
    # Drop huge station_reports duplication in console; keep on disk
    write_json(summary_path, result)
    printable = {k: v for k, v in result.items() if k not in {"selected_stations", "station_reports"}}
    printable["selected_station_ids"] = [s["station_id"] for s in result.get("selected_stations") or []]
    print(json.dumps(printable, indent=2))
    print(f"\nSummary written to {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
