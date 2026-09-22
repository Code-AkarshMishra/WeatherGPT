"""
Live ERA5 historical analysis (Open-Meteo archive).

Usage:
    python scripts/test_historical_analysis.py
    python scripts/test_historical_analysis.py --message "last 5 years" --name Lucknow
    python scripts/test_historical_analysis.py --message "Compare rainfall in Lucknow and Kanpur over the last 5 years."
"""
import argparse
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.historical_analysis import run_historical_query
from app.services.location import search_location


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="Lucknow")
    parser.add_argument("--message", default="last 1 year rainfall")
    parser.add_argument("--lat", type=float, default=None)
    parser.add_argument("--lon", type=float, default=None)
    parser.add_argument("--verify", action="store_true", help="Include GFS/ECMWF previous-run verification")
    args = parser.parse_args()

    lat, lon, name = args.lat, args.lon, args.name
    if lat is None or lon is None:
        place = search_location(name)
        if place and not place.get("error"):
            lat = place["latitude"]
            lon = place["longitude"]
            name = place.get("name") or name

    result = run_historical_query(
        args.message,
        latitude=lat,
        longitude=lon,
        location_name=name,
        include_verification=args.verify,
        use_cache=True,
    )
    print("=" * 60)
    print(" WeatherGPT — Historical / climate analysis")
    print("=" * 60)
    print(f"Query: {args.message}")
    print(f"Mode: {result.get('mode')}")
    print(f"Period: {result.get('period')}")
    if not result.get("available"):
        print(f"ERROR: {result.get('error')}")
        return
    if result.get("mode") == "multi_city":
        print(f"Comparison: {result.get('comparison')}")
        print(f"Wettest: {result.get('wettest_location')}")
    else:
        print(f"Location: {result.get('location')}")
        print(f"Metrics: {result.get('metrics')}")
        print(f"Baseline: {result.get('baseline')}")
        print(f"Departures: {result.get('departures')}")
    if result.get("nwp_verification"):
        nv = result["nwp_verification"]
        print(f"GFS rainfall: {(nv.get('gfs') or {}).get('rainfall')}")
        print(f"ECMWF rainfall: {(nv.get('ecmwf') or {}).get('rainfall')}")
        print(f"Comparison: {nv.get('comparison')}")
    print()
    print(result.get("disclaimer"))


if __name__ == "__main__":
    main()
