"""
Live GFS/ECMWF previous-run verification vs ERA5.

Usage:
    python scripts/test_nwp_verification.py --name Lucknow
    python scripts/test_nwp_verification.py --message "last 90 days" --name Mumbai
"""
import argparse
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.historical_analysis import parse_period
from app.services.location import search_location
from app.services.nwp_verification import verify_models


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="Lucknow")
    parser.add_argument("--message", default="last 90 days")
    parser.add_argument("--lat", type=float, default=None)
    parser.add_argument("--lon", type=float, default=None)
    args = parser.parse_args()

    lat, lon, name = args.lat, args.lon, args.name
    if lat is None or lon is None:
        place = search_location(name)
        if not place or place.get("error"):
            raise SystemExit(f"Could not geocode {name}: {place}")
        lat = place["latitude"]
        lon = place["longitude"]
        name = place.get("name") or name

    period = parse_period(args.message)
    if not period.get("available"):
        raise SystemExit(period.get("error"))

    result = verify_models(lat, lon, period["start"], period["end"], location_name=name)
    print("=" * 60)
    print(" WeatherGPT — NWP forecast vs observation")
    print("=" * 60)
    print(f"Location: {name} ({lat}, {lon})")
    print(f"Date range: {result.get('period')}")
    print(f"Lead time: {result.get('lead_time')}")
    if not result.get("available"):
        print(f"ERROR: {result.get('error')}")
        return
    gfs = result.get("gfs") or {}
    ecm = result.get("ecmwf") or {}
    print(f"GFS available: {gfs.get('available')} rainfall={gfs.get('rainfall')}")
    print(f"ECMWF available: {ecm.get('available')} rainfall={ecm.get('rainfall')}")
    print(f"Model comparison: {result.get('comparison')}")
    print()
    print(result.get("disclaimer"))


if __name__ == "__main__":
    main()
