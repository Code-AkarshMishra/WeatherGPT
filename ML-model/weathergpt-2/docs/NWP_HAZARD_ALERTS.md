# NWP-based live hazard alerts

WeatherGPT does not replace official meteorological warnings. Its NWP hazard assessment is a decision-support layer that helps interpret forecast conditions.

## What NWP means

**Numerical Weather Prediction (NWP)** is a physics-based computer forecast: atmospheric equations are integrated forward in time on a grid. GFS (NOAA) and ECMWF IFS are two independent global NWP systems. Agreement between them is **forecast consistency**, not a probability that an event will occur.

This service does **not** run WRF or GFS itself. It **consumes published NWP output** through Open-Meteo’s explicit model APIs:

- GFS: `https://api.open-meteo.com/v1/gfs` ([docs](https://open-meteo.com/en/docs/gfs-api))
- ECMWF IFS: `https://api.open-meteo.com/v1/ecmwf` ([docs](https://open-meteo.com/en/docs/ecmwf-api))

The generic Open-Meteo `/v1/forecast` blend remains in use for everyday chat weather. The NWP layer is **additional**.

## Pipeline

```text
lat/lon (existing location resolver)
        ↓
GFS hourly (~48h) + ECMWF hourly (~48h)
        ↓
Window stats (1h / 6h / 12h / 24h / 48h rain, wind, gusts, CAPE)
        ↓
Rules-based hazard screen (configurable thresholds)
        ↓
Model-agreement label (high / moderate / low / single_model)
        ↓
NWP Hazard Assessment  (normal | watch | elevated | high)
        ↓
Role-specific advisory text  +  optional Gemini explanation
```

The LLM never invents millimetres, wind, CAPE, or official warnings. Chat injects a structured block; Gemini only explains it.

## Hazard types (screening, not official warnings)

| Type | Uses |
|------|------|
| `heavy_rain` | Max hourly precip, rolling 6h/12h totals, 24h/48h totals, PoP if GFS provides it |
| `strong_wind` | Max 10 m wind and gusts |
| `extreme_heat` | Max 2 m temperature vs prototype screens (38 / 40 / 42 °C) — not an IMD heatwave |
| `cyclone_related` | Strong wind **and** rainfall **and** low/falling pressure together. Does **not** identify a cyclone |

CAPE alone is **not** treated as “a thunderstorm will occur.”

## Model agreement

For a pair of values (e.g. GFS vs ECMWF 24h rain):

`relative_difference = |a − b| / max(|a|, |b|, 1)`

- `high` if ≤ 0.25
- `moderate` if ≤ 0.50
- `low` if > 0.50
- `single_model` if only one model returned data

This is **not** a confidence percentage.

## Thresholds

Prototype screens live in `app/core/nwp_config.py` (`HAZARD_THRESHOLDS`). They loosely echo common 24h rainfall bands used in Indian operational practice **but are not IMD official warning thresholds**. Override any value with env `NWP_THRESHOLD_<NAME>` (e.g. `NWP_THRESHOLD_HEAVY_RAIN_24H_MM=80`).

Cache TTL: `NWP_CACHE_TTL_SECONDS` (default 1800). NWP cycles are ~6-hourly; chat does not re-hit GFS/ECMWF on every message if the cache is warm.

## API

`POST /nwp/hazard-assessment`

```json
{
  "latitude": 26.8467,
  "longitude": 80.9462,
  "role": "farmer"
}
```

Or `{ "location": { "name": "Lucknow" } }` to geocode with the existing location service.

If both models fail, the API returns `available: false` and **makes no hazard claim**.

`official_warning` is always `false` on this object.

The same structured assessment is consumed by the Flood & Disaster role (`docs/FLOOD_DISASTER.md`) without a second GFS/ECMWF fetch.

## What this does **not** do

- Run WRF
- Train ML
- Predict floods or cyclones
- Issue evacuations
- Fabricate IMD / official warnings
- Invent a scientific probability from model agreement

## Local test

```bash
cd weathergpt-2
.\.venv\Scripts\python.exe -m pytest tests/test_nwp.py -q
.\.venv\Scripts\python.exe scripts/test_nwp.py --name Lucknow --role farmer
```
