#!/usr/bin/env python3
"""Resume ECMWF + GHCN acquisition for india_ml_v1 without re-downloading GFS.

Uses run_id 20260918T131440Z and skips existing ECMWF chunk CSVs.
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
from ml_data_pipeline.open_meteo_nwp import download_nwp_for_locations, iter_date_chunks  # noqa: E402

DEFAULT_RUN_ID = "20260918T131440Z"


def list_existing_ecmwf_chunks(run_id: str) -> list[str]:
    chunk_dir = RAW_ROOT / "open_meteo" / "ecmwf" / "chunks" / run_id
    if not chunk_dir.exists():
        return []
    return sorted(p.name for p in chunk_dir.glob("ecmwf_*_lead1.csv"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Resume ECMWF+GHCN only (skip GFS).")
    parser.add_argument("--config", type=Path, default=CONFIGS_ROOT / "india_ml_v1.json")
    parser.add_argument("--run-id", type=str, default=DEFAULT_RUN_ID)
    parser.add_argument("--start", type=str, default=None)
    parser.add_argument("--end", type=str, default=None)
    parser.add_argument("--sleep", type=float, default=0.3)
    parser.add_argument("--ecmwf-only", action="store_true")
    parser.add_argument("--ghcn-only", action="store_true")
    args = parser.parse_args()

    cfg = load_region_config(args.config)
    bbox = cfg["bbox"]
    step = float((cfg.get("nwp_grid") or {}).get("step_deg") or 3.0)
    chunk_days = int((cfg.get("nwp") or {}).get("chunk_days") or 31)
    lead_days = list((cfg.get("nwp") or {}).get("lead_days") or [1])
    dates = cfg.get("default_date_range") or {}
    start = args.start or dates.get("start") or "2024-02-01"
    end = args.end or dates.get("end") or "2026-09-16"

    locations = grid_points_from_bbox(
        bbox["min_lat"], bbox["max_lat"], bbox["min_lon"], bbox["max_lon"], step
    )
    planned = iter_date_chunks(start, end, chunk_days)
    existing = list_existing_ecmwf_chunks(args.run_id)

    print(f"run_id={args.run_id}")
    print(f"date_range={start} -> {end}")
    print(f"grid_points={len(locations)} step_deg={step}")
    print(f"planned_ecmwf_chunks={len(planned)}")
    print(f"existing_ecmwf_chunks={len(existing)}")
    for name in existing:
        print(f"  existing: {name}")

    nwp_summary = None
    ghcn_result = None

    if not args.ghcn_only:
        print("Resuming ECMWF Previous Runs (skip existing chunks; GFS untouched)...", flush=True)
        nwp_summary = download_nwp_for_locations(
            locations,
            start_date=start,
            end_date=end,
            models=["ecmwf"],
            lead_days=lead_days,
            base_vars=list(NWP_BASE_VARS),
            sleep_s=args.sleep,
            chunk_days=chunk_days,
            run_id=args.run_id,
            skip_existing_chunks=True,
        )
        write_json(RAW_ROOT / "open_meteo" / "last_ecmwf_resume_summary.json", nwp_summary)

    if not args.ecmwf_only:
        print("Downloading GHCN-Daily PRCP for India bbox (no max_stations cap)...", flush=True)
        ghcn_cfg = cfg.get("ghcn") or {}
        ghcn_result = download_ghcn(
            countries=list(cfg.get("countries") or ["IN"]),
            bbox=bbox if ghcn_cfg.get("use_bbox", True) else None,
            elements=list(ghcn_cfg.get("elements") or ["PRCP"]),
            start_date=start,
            end_date=end,
            min_years_coverage=int(ghcn_cfg.get("min_years_coverage") or 1),
            max_stations=None,
            sleep_s=min(args.sleep, 0.25),
        )
        summary_payload = {
            k: v for k, v in ghcn_result.items() if k not in {"selected_stations", "station_reports"}
        }
        summary_payload["selected_station_ids"] = [
            s["station_id"] for s in (ghcn_result.get("selected_stations") or [])
        ]
        write_json(RAW_ROOT / "ghcn" / "last_ghcn_download_summary.json", summary_payload)

    manifest = {
        "acquisition_name": f"{cfg.get('name')}_ecmwf_ghcn_resume",
        "download_timestamp_utc": utc_now_iso(),
        "run_id": args.run_id,
        "gfs_untouched": True,
        "date_range": {"start": start, "end": end},
        "grid": {"bbox": bbox, "step_deg": step, "location_count": len(locations)},
        "lead_days": lead_days,
        "ecmwf": (nwp_summary or {}).get("models", {}).get("ecmwf") if nwp_summary else None,
        "ghcn": {
            "station_count": (ghcn_result or {}).get("station_count"),
            "row_count": (ghcn_result or {}).get("row_count"),
            "combined_csv": (ghcn_result or {}).get("combined_csv"),
            "stations_ok": (ghcn_result or {}).get("stations_ok"),
        }
        if ghcn_result
        else None,
    }
    out = RAW_ROOT / "acquisition_manifest_ecmwf_ghcn_resume.json"
    write_json(out, manifest)
    print(json.dumps(manifest, indent=2))
    print(f"Manifest: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
