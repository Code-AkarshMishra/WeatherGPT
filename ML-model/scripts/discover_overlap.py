#!/usr/bin/env python3
"""Discover verified GFS/ECMWF/GHCN overlap before full ML acquisition."""
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

from ml_data_pipeline import CONFIGS_ROOT  # noqa: E402
from ml_data_pipeline.overlap import discover_overlap  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover GFS/ECMWF/GHCN overlapping date range.")
    parser.add_argument(
        "--config",
        type=Path,
        default=CONFIGS_ROOT / "india_ml_v1.json",
    )
    args = parser.parse_args()
    report = discover_overlap(args.config)
    print(json.dumps(report, indent=2))
    vo = report.get("verified_overlap") or {}
    print("\n=== VERIFIED OVERLAP ===")
    print(f"available: {vo.get('available')}")
    print(f"start: {vo.get('start')}")
    print(f"end: {vo.get('end')}")
    print(f"nwp_grid_points: {report.get('nwp_grid_point_count')}")
    print(f"ghcn_stations: {report.get('ghcn_stations_matching_filter')}")
    return 0 if vo.get("available") else 1


if __name__ == "__main__":
    raise SystemExit(main())
