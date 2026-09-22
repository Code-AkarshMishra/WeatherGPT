# Historical / climate analysis and NWP verification

WeatherGPT does not replace official meteorological warnings. Historical statistics here are **ERA5 reanalysis via Open-Meteo**, not rain-gauge observations and not an official climate-change assessment.

## What was weak before

- `get_historical_weather` called the Open-Meteo **archive** API but returned **only the first day** of a range.
- `POST /climate/analyze` used **demo JSON** for Lucknow/Delhi/Mumbai (including a placeholder p-value).
- No multi-city comparison, no extreme-day counts from live data, no GFS/ECMWF forecast verification.
- Gemini could only fetch a single past date (or demo monthly normals).

## What this uses

| Layer | Endpoint | Role |
|-------|----------|------|
| Historical weather | `https://archive-api.open-meteo.com/v1/archive` | ERA5 daily reanalysis (existing `weather.py`, now full ranges) |
| Previous-run NWP | `https://previous-runs-api.open-meteo.com/v1/forecast` | GFS (`gfs_global`) and ECMWF IFS 0.25° (`ecmwf_ifs025`) at **previous_day1** (~24 h lead) |
| Live NWP (unchanged) | `/v1/gfs` and `/v1/ecmwf` | Forward hazard screen |

The generic `/v1/forecast` path is **not** replaced.

## Periods

Supported in natural language: last 30/90 days, 6 months, 1/3/5/10 years, this year, `YYYY-YYYY`, `YYYY-MM-DD to YYYY-MM-DD`.

ERA5 has ~5 days lag. Ranges longer than 10 years are clamped. Missing days are flagged, never filled.

## Classification (do not confuse these)

- **short-term anomaly** — under 90 days
- **seasonal/annual comparison** — under ~1 year
- **multi-year record** — up to 10 years in this service; **not** a long-term climate trend (<20 years)

Same-calendar-window baselines (this period vs previous years) are computed only for windows shorter than ~400 days. Multi-year requests report the record itself so overlapping 5-year lookbacks are not treated as a climate normal.

## Extremes

Heavy-rain and hot-day counts use **WeatherGPT screening thresholds** from `nwp_config.py` (e.g. 64.5 mm/day, 38 °C). They are **not** official IMD warning thresholds.

## NWP verification

Previous-run hourly precipitation is summed to daily totals and compared with ERA5 daily rainfall.

Metrics: MAE, RMSE, bias (forecast − observed). For rainfall, **wet-day MAE** (observed ≥ 1 mm) is also reported because zeros dominate otherwise. Pearson correlation only if n ≥ 10 and both series have variance.

Open-Meteo previous-runs coverage is mostly from **2024-01-01**. Older windows return a clear error. Skill is **for that location and period only** — the system will not say ECMWF is always better than GFS.

## Flood & Disaster

When coordinates are available, the role consumes the same-month ERA5 baseline vs NWP 24 h rainfall. It still does **not** predict floods.

## APIs

- `POST /climate/historical-analysis`
- `POST /climate/nwp-verification`
- `POST /climate/analyze` — multi-year ERA5 statistics (not demo climatology; no fabricated p-values)

Chat injects a compact stats block (not raw hourly). Optional `historical_analysis` (including `charts` series) is for the MERN UI.

## Local tests

```powershell
python -m pytest tests/test_historical_analysis.py -q
python scripts/test_historical_analysis.py --message "last 5 years" --name Lucknow
python scripts/test_historical_analysis.py --message "Compare rainfall in Lucknow and Kanpur over the last 5 years."
python scripts/test_nwp_verification.py --name Lucknow --message "last 90 days"
```
