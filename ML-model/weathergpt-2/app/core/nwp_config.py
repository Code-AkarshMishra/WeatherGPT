"""
Configurable screening thresholds for NWP hazard detection.

These are prototype WeatherGPT screening thresholds — NOT official IMD
warning criteria. Do not label outputs as official warnings.
"""
import os

# Open-Meteo explicit NWP endpoints (not the generic /v1/forecast blend)
GFS_URL = "https://api.open-meteo.com/v1/gfs"
ECMWF_URL = "https://api.open-meteo.com/v1/ecmwf"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
PREVIOUS_RUNS_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
PREVIOUS_RUNS_GFS_MODEL = "gfs_global"
PREVIOUS_RUNS_ECMWF_MODEL = "ecmwf_ifs025"
# Previous-runs coverage is mostly from Jan 2024 (see Open-Meteo docs).
NWP_ARCHIVE_MIN_DATE = "2024-01-01"

NWP_FORECAST_HOURS = 48
NWP_CACHE_TTL_SECONDS = int(os.getenv("NWP_CACHE_TTL_SECONDS", "1800"))  # 30 min
HISTORICAL_CACHE_TTL_SECONDS = int(os.getenv("HISTORICAL_CACHE_TTL_SECONDS", "21600"))  # 6 h
NWP_HTTP_TIMEOUT = 12.0
ARCHIVE_HTTP_TIMEOUT = 30.0
ERA5_LAG_DAYS = 5
MAX_HISTORICAL_YEARS = 10

# Variables actually documented on each Open-Meteo NWP endpoint.
# thunderstorm_probability exists on GFS only via NBM (often empty outside NA).
# ECMWF does not publish 2 m humidity or precipitation probability.
GFS_HOURLY_CORE = [
    "precipitation",
    "rain",
    "precipitation_probability",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "temperature_2m",
    "relative_humidity_2m",
    "pressure_msl",
    "cloud_cover",
    "cape",
]
GFS_HOURLY_OPTIONAL = ["thunderstorm_probability"]

ECMWF_HOURLY = [
    "precipitation",
    "rain",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "temperature_2m",
    "pressure_msl",
    "cloud_cover",
    "cape",
]

# Screening thresholds (prototype). Rain bands loosely echo common
# 24h rainfall categories used in Indian operational practice.
# They are NOT IMD official warning thresholds.
HAZARD_THRESHOLDS: dict[str, float] = {
    # Rainfall (mm)
    "rain_watch_24h_mm": 30.0,
    "heavy_rain_24h_mm": 64.5,
    "very_heavy_rain_24h_mm": 115.6,
    "extreme_rain_24h_mm": 204.5,
    "heavy_rain_1h_mm": 20.0,
    "extreme_rain_1h_mm": 40.0,
    "heavy_rain_6h_mm": 50.0,
    "heavy_rain_12h_mm": 75.0,
    # Wind (km/h) — Beaufort-inspired screening
    "strong_wind_kmh": 40.0,
    "gale_wind_kmh": 62.0,
    "extreme_wind_kmh": 75.0,
    "strong_gust_kmh": 55.0,
    "gale_gust_kmh": 75.0,
    "extreme_gust_kmh": 90.0,
    # Convective environment (CAPE J/kg) — environment only, not a storm forecast
    "cape_watch_jkg": 1000.0,
    "cape_elevated_jkg": 2000.0,
    "cape_high_jkg": 3000.0,
    "thunderstorm_probability_watch": 30.0,
    "thunderstorm_probability_high": 60.0,
    # Absolute 2 m temperature screens (°C) — not IMD heatwave criteria
    "heat_watch_c": 38.0,
    "very_hot_c": 40.0,
    "extreme_heat_c": 42.0,
    # Cyclone-related *conditions* screen (combination only; not cyclone detection)
    "cyclone_low_pressure_hpa": 1000.0,
    "cyclone_pressure_drop_hpa": 4.0,
    # Model-agreement relative difference |a-b|/max(a,b)
    "agreement_high_rel_diff": 0.25,
    "agreement_moderate_rel_diff": 0.50,
    # Historical screening (not official warning thresholds)
    "rainy_day_mm": 1.0,
}


def threshold(name: str) -> float:
    override = os.getenv(f"NWP_THRESHOLD_{name.upper()}")
    if override:
        return float(override)
    return float(HAZARD_THRESHOLDS[name])
