#!/usr/bin/env python3
"""Run expanded India ML raw-data acquisition (NWP + GHCN) and write a manifest.

Does NOT train models or create labels.
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
    CONFIGS_ROOT,
    NWP_BASE_VARS,
    RAW_ROOT,
    grid_points_from_bbox,
    load_region_config,
    utc_now_iso,
    write_json,
)
from ml_data_pipeline.ghcn import download_ghcn  # noqa: E402
from ml_data_pipeline.open_meteo_nwp import download_nwp_for_locations  # noqa: E402
from ml_data_pipeline.overlap import discover_overlap  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Acquire India ML raw NWP+GHCN datasets.")
    parser.add_argument("--config", type=Path, default=CONFIGS_ROOT / "india_ml_v1.json")
    parser.add_argument("--start", type=str, default=None, help="Override overlap start")
    parser.add_argument("--end", type=str, default=None, help="Override overlap end")
    parser.add_argument("--step-deg", type=float, default=None)
    parser.add_argument("--chunk-days", type=int, default=None)
    parser.add_argument("--sleep", type=float, default=0.35)
    parser.add_argument("--skip-overlap-discovery", action="store_true")
    parser.add_argument("--nwp-only", action="store_true")
    parser.add_argument("--ghcn-only", action="store_true")
    parser.add_argument("--max-stations", type=int, default=None)
    args = parser.parse_args()

    cfg = load_region_config(args.config)
    bbox = cfg["bbox"]
    step = args.step_deg if args.step_deg is not None else float((cfg.get("nwp_grid") or {}).get("step_deg") or 3.0)
    chunk_days = args.chunk_days if args.chunk_days is not None else int((cfg.get("nwp") or {}).get("chunk_days") or 31)
    lead_days = list((cfg.get("nwp") or {}).get("lead_days") or [1])
    models = list((cfg.get("nwp") or {}).get("models") or ["gfs", "ecmwf"])

    if args.skip_overlap_discovery and not (args.start and args.end):
        raise SystemExit("Provide --start and --end when skipping overlap discovery.")

    if args.skip_overlap_discovery:
        start, end = args.start, args.end
        overlap_report = {"verified_overlap": {"available": True, "start": start, "end": end, "skipped": True}}
    else:
        print("Discovering verified overlap...", flush=True)
        overlap_report = discover_overlap(args.config)
        vo = overlap_report.get("verified_overlap") or {}
        if not vo.get("available"):
            write_json(RAW_ROOT / "acquisition_aborted.json", overlap_report)
            raise SystemExit("Overlap discovery failed; aborting acquisition.")
        start = args.start or vo["start"]
        end = args.end or vo["end"]
        print(f"Verified overlap: {start} -> {end}", flush=True)
        print(f"GHCN stations matching filter: {overlap_report.get('ghcn_stations_matching_filter')}", flush=True)
        print(f"NWP grid points: {overlap_report.get('nwp_grid_point_count')}", flush=True)

    locations = grid_points_from_bbox(
        bbox["min_lat"], bbox["max_lat"], bbox["min_lon"], bbox["max_lon"], step
    )
    print(f"Using {len(locations)} grid points at step_deg={step}", flush=True)

    nwp_summary = None
    ghcn_result = None

    if not args.ghcn_only:
        print("Downloading NWP Previous Runs (chunked)...", flush=True)
        nwp_summary = download_nwp_for_locations(
            locations,
            start_date=start,
            end_date=end,
            models=models,
            lead_days=lead_days,
            base_vars=list(NWP_BASE_VARS),
            sleep_s=args.sleep,
            chunk_days=chunk_days,
        )
        write_json(RAW_ROOT / "open_meteo" / "last_nwp_download_summary.json", nwp_summary)

    if not args.nwp_only:
        print("Downloading GHCN-Daily PRCP...", flush=True)
        ghcn_cfg = cfg.get("ghcn") or {}
        max_stations = args.max_stations
        if max_stations is None:
            max_stations = ghcn_cfg.get("max_stations")
        ghcn_result = download_ghcn(
            countries=list(cfg.get("countries") or ["IN"]),
            bbox=bbox if ghcn_cfg.get("use_bbox", True) else None,
            elements=list(ghcn_cfg.get("elements") or ["PRCP"]),
            start_date=start,
            end_date=end,
            min_years_coverage=int(ghcn_cfg.get("min_years_coverage") or 1),
            max_stations=max_stations,
            sleep_s=min(args.sleep, 0.3),
        )
        summary_payload = {
            k: v for k, v in ghcn_result.items() if k not in {"selected_stations", "station_reports"}
        }
        summary_payload["selected_station_ids"] = [
            s["station_id"] for s in (ghcn_result.get("selected_stations") or [])
        ]
        write_json(RAW_ROOT / "ghcn" / "last_ghcn_download_summary.json", summary_payload)

    manifest = {
        "acquisition_name": cfg.get("name"),
        "download_timestamp_utc": utc_now_iso(),
        "config": str(args.config),
        "source_urls": {
            "previous_runs": "https://previous-runs-api.open-meteo.com/v1/forecast",
            "previous_runs_docs": "https://open-meteo.com/en/docs/previous-runs-api",
            "ghcn_by_station": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station",
            "ghcn_stations": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt",
            "ghcn_inventory": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt",
        },
        "models": models,
        "date_range": {"start": start, "end": end},
        "grid": {
            "bbox": bbox,
            "step_deg": step,
            "location_count": len(locations),
            "locations": locations,
        },
        "lead_days": lead_days,
        "chunk_days": chunk_days,
        "variables": list(NWP_BASE_VARS),
        "ghcn_elements": list((cfg.get("ghcn") or {}).get("elements") or ["PRCP"]),
        "overlap_discovery": overlap_report.get("verified_overlap"),
        "nwp": {
            model: {
                "row_count": (nwp_summary or {}).get("models", {}).get(model, {}).get("row_count"),
                "file_count": (nwp_summary or {}).get("models", {}).get(model, {}).get("file_count"),
                "chunk_dir": (nwp_summary or {}).get("models", {}).get(model, {}).get("chunk_dir"),
                "request_failures": (nwp_summary or {}).get("models", {}).get(model, {}).get("request_failures"),
            }
            for model in models
        }
        if nwp_summary
        else None,
        "ghcn": {
            "station_count": (ghcn_result or {}).get("station_count"),
            "row_count": (ghcn_result or {}).get("row_count"),
            "combined_csv": (ghcn_result or {}).get("combined_csv"),
            "stations_ok": (ghcn_result or {}).get("stations_ok"),
            "selected_station_ids": [
                s["station_id"] for s in ((ghcn_result or {}).get("selected_stations") or [])
            ],
        }
        if ghcn_result
        else None,
        "notes": [
            "Raw acquisition only. No labels, no training, no imputed weather values.",
            "Missing meteorological fields remain empty/null in CSV.",
        ],
    }
    manifest_path = RAW_ROOT / "acquisition_manifest.json"
    write_json(manifest_path, manifest)
    print(json.dumps({k: v for k, v in manifest.items() if k != "grid"}, indent=2))
    print(f"\nManifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
