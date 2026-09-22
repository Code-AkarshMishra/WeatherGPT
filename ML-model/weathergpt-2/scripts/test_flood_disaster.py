"""
Live Flood & Disaster assessment (reuses cached NWP GFS + ECMWF).

Usage:
    python scripts/test_flood_disaster.py
    python scripts/test_flood_disaster.py --name Mumbai
    python scripts/test_flood_disaster.py --lat 26.8467 --lon 80.9462 --name Lucknow
"""
import argparse
import sys
from pathlib import Path
from typing import Optional

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.flood_disaster import build_disaster_assessment, compact_disaster_for_ui
from app.services.location import search_location
from app.services.nwp_hazards import assess_nwp_hazards_for_location


def run_one(name: str, lat: Optional[float], lon: Optional[float]) -> None:
    if lat is None or lon is None:
        place = search_location(name)
        if not place or place.get("error"):
            raise SystemExit(f"Could not geocode {name}: {place}")
        lat = place["latitude"]
        lon = place["longitude"]
        name = place.get("name") or name

    nwp = assess_nwp_hazards_for_location(
        latitude=lat,
        longitude=lon,
        location_name=name,
        role="flood_disaster",
        use_cache=True,
    )
    disaster = build_disaster_assessment(nwp, official_warnings=[], location_name=name)
    ui = compact_disaster_for_ui(disaster)

    print("=" * 60)
    print(" WeatherGPT — Flood & Disaster role")
    print("=" * 60)
    print(f"Location: {name} ({lat}, {lon})")
    print(f"NWP models available: {disaster.get('available_models')}")
    if not disaster.get("available"):
        print(f"ERROR: {disaster.get('error')}")
        print("No disaster-hazard claim is made.")
        return

    g24 = ((nwp.get("model_stats") or {}).get("gfs") or {}).get("h24") or {}
    e24 = ((nwp.get("model_stats") or {}).get("ecmwf") or {}).get("h24") or {}
    print(f"GFS 24h rain mm / max wind / gust: {g24.get('precip_24h_mm')} / {g24.get('max_wind_kmh')} / {g24.get('max_gust_kmh')}")
    print(f"ECMWF 24h rain mm / max wind / gust: {e24.get('precip_24h_mm')} / {e24.get('max_wind_kmh')} / {e24.get('max_gust_kmh')}")
    print(f"Detected hazards: {ui.get('hazards')}")
    print(f"Hazard severity / overall risk: {disaster.get('overall_risk')}")
    print(f"Model agreement: {disaster.get('model_agreement')}")
    print(f"Forecast window: {disaster.get('forecast_window')}")
    print(f"Official warning status: {ui.get('official_warning_status')}")
    print(f"WeatherGPT official_warning flag: {disaster.get('official_warning')}")
    if disaster.get("heat_vs_baseline"):
        print(f"Heat vs baseline: {disaster.get('heat_vs_baseline')}")
    if disaster.get("rainfall_concern"):
        print(f"Rainfall concern: {disaster.get('rainfall_concern')}")
    print()
    print("Situation:")
    print(disaster.get("situation"))
    print()
    print("Generated disaster advisory:")
    print(disaster.get("advisory"))
    print()
    print(disaster.get("disclaimer"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lat", type=float, default=None)
    parser.add_argument("--lon", type=float, default=None)
    parser.add_argument("--name", default="Lucknow")
    parser.add_argument(
        "--also",
        nargs="*",
        default=[],
        help="Extra place names to run after the primary location",
    )
    args = parser.parse_args()
    run_one(args.name, args.lat, args.lon)
    for extra in args.also:
        print()
        run_one(extra, None, None)


if __name__ == "__main__":
    main()
