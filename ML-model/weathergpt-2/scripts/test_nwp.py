"""
Live NWP hazard screen (GFS + ECMWF via Open-Meteo).

Usage:
    python scripts/test_nwp.py
    python scripts/test_nwp.py --lat 26.8467 --lon 80.9462 --name Lucknow --role farmer
"""
import argparse
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.location import search_location
from app.services.nwp_hazards import assess_nwp_hazards_for_location


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lat", type=float, default=None)
    parser.add_argument("--lon", type=float, default=None)
    parser.add_argument("--name", default="Lucknow")
    parser.add_argument("--role", default="citizen")
    args = parser.parse_args()

    lat, lon, name = args.lat, args.lon, args.name
    if lat is None or lon is None:
        place = search_location(name)
        if not place or place.get("error"):
            raise SystemExit(f"Could not geocode {name}: {place}")
        lat = place["latitude"]
        lon = place["longitude"]
        name = place.get("name") or name

    result = assess_nwp_hazards_for_location(
        latitude=lat,
        longitude=lon,
        location_name=name,
        role=args.role,
        use_cache=False,
    )

    print("=" * 60)
    print(" WeatherGPT — NWP Hazard Assessment")
    print("=" * 60)
    print(f"Location: {name} ({lat}, {lon})")
    if not result.get("available"):
        print(f"ERROR: {result.get('error')}")
        print("No weather/hazard claim is made.")
        return

    g24 = ((result.get("model_stats") or {}).get("gfs") or {}).get("h24") or {}
    e24 = ((result.get("model_stats") or {}).get("ecmwf") or {}).get("h24") or {}
    print(f"GFS available: {result.get('models', {}).get('gfs', {}).get('available')}")
    print(f"ECMWF available: {result.get('models', {}).get('ecmwf', {}).get('available')}")
    print(f"GFS rainfall (24h mm): {g24.get('precip_24h_mm')}")
    print(f"ECMWF rainfall (24h mm): {e24.get('precip_24h_mm')}")
    print(f"GFS max wind / gust (km/h): {g24.get('max_wind_kmh')} / {g24.get('max_gust_kmh')}")
    print(f"ECMWF max wind / gust (km/h): {e24.get('max_wind_kmh')} / {e24.get('max_gust_kmh')}")
    print(f"Hazards detected: {result.get('hazards')}")
    print(f"Model agreement: {result.get('model_agreement')}")
    print(f"Overall risk: {result.get('overall_risk')}")
    print(f"Official warning: {result.get('official_warning')}")
    print()
    print("Generated advisory:")
    print(result.get("advisory"))
    print()
    print(result.get("disclaimer"))


if __name__ == "__main__":
    main()
