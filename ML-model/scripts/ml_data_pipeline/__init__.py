"""Shared helpers for WeatherGPT ML raw-data acquisition (no training)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# scripts/ml_data_pipeline/__init__.py → repo root is parents[2]
REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = REPO_ROOT / "data"
RAW_ROOT = DATA_ROOT / "raw"
PROCESSED_ROOT = DATA_ROOT / "processed"
CONFIGS_ROOT = DATA_ROOT / "configs"

PREVIOUS_RUNS_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
SINGLE_RUNS_URL = "https://single-runs-api.open-meteo.com/v1/forecast"

# Models used by WeatherGPT NWP layer
MODEL_IDS = {
    "gfs": "gfs_global",
    "ecmwf": "ecmwf_ifs025",
}

# Documented Previous Runs common coverage (Open-Meteo)
PREVIOUS_RUNS_COMMON_START = "2024-01-01"

# Base variables (suffix _previous_day{N} added at request time)
NWP_BASE_VARS = [
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

# Units as returned with Open-Meteo defaults (°C, mm, km/h, hPa, J/kg, %)
NWP_UNITS = {
    "precipitation": "mm",
    "rain": "mm",
    "temperature_2m": "°C",
    "relative_humidity_2m": "%",
    "pressure_msl": "hPa",
    "surface_pressure": "hPa",
    "wind_speed_10m": "km/h",
    "wind_gusts_10m": "km/h",
    "wind_direction_10m": "°",
    "cape": "J/kg",
    "precipitation_probability": "%",
}

GHCN_BASE = "https://www.ncei.noaa.gov/pub/data/ghcn/daily"
GHCN_STATIONS_URL = f"{GHCN_BASE}/ghcnd-stations.txt"
GHCN_INVENTORY_URL = f"{GHCN_BASE}/ghcnd-inventory.txt"
GHCN_COUNTRIES_URL = f"{GHCN_BASE}/ghcnd-countries.txt"
GHCN_BY_STATION_URL = f"{GHCN_BASE}/by_station"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_region_config(path: Optional[Path] = None) -> dict[str, Any]:
    cfg_path = path or (CONFIGS_ROOT / "india_north_pilot.json")
    with open(cfg_path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")


def write_metadata(path: Path, **fields: Any) -> Path:
    meta = {
        "retrieval_time_utc": utc_now_iso(),
        **fields,
    }
    write_json(path, meta)
    return path


def grid_points_from_bbox(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    step_deg: float,
) -> list[dict[str, float]]:
    if step_deg <= 0:
        raise ValueError("step_deg must be > 0")
    points: list[dict[str, float]] = []
    lat = min_lat
    while lat <= max_lat + 1e-9:
        lon = min_lon
        while lon <= max_lon + 1e-9:
            points.append({"latitude": round(lat, 4), "longitude": round(lon, 4)})
            lon += step_deg
        lat += step_deg
    return points


def parse_locations_arg(text: Optional[str]) -> Optional[list[dict[str, float]]]:
    """Parse 'lat,lon;lat,lon' into location dicts."""
    if not text:
        return None
    out: list[dict[str, float]] = []
    for chunk in text.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        lat_s, lon_s = chunk.split(",")
        out.append({"latitude": float(lat_s.strip()), "longitude": float(lon_s.strip())})
    return out
