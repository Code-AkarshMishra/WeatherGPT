# Flood & Disaster role

WeatherGPT does not replace official meteorological warnings. Its NWP hazard assessment is a decision-support layer that helps interpret forecast conditions.

## Purpose

The Flood & Disaster role (`flood_disaster`, UI label **Flood & Disaster**) answers:

> What disaster-related hazards are developing here, how severe are they, when are they expected, how consistent are the NWP models, and what should the user be aware of?

It is **not** a normal weather chatbot and it does **not** predict floods or cyclones.

## Architecture (reuse, do not duplicate)

```text
GFS / ECMWF  (existing NWP service + cache)
      ↓
Existing hazard engine
      ↓
Hazard assessment
 ├── Extreme rainfall (heavy_rain)
 ├── Strong wind
 ├── Thunderstorm / convective conditions
 ├── Extreme heat
 └── Cyclone-related conditions  (combination screen only)
      ↓
Flood & Disaster role  (interpretation only)
      ↓
Disaster-oriented advisory  +  optional Gemini explanation
```

The role **never** calls GFS or ECMWF itself. It consumes `analyze_nwp_hazards()` / `assess_nwp_hazards_for_location()`.

## Official warning vs WeatherGPT assessment

These are separate fields:

| Layer | Meaning |
|-------|---------|
| Official warning | Only if the MERN backend sent `alert_context`. Never taken from demo Lucknow/Delhi/Mumbai bulletins. |
| NWP forecast | GFS / ECMWF numbers |
| WeatherGPT NWP Hazard Assessment | Rules-based screen (`normal` / `watch` / `elevated` / `high`) |
| Advisory | Role-specific decision-support text |

`official_warning` on WeatherGPT objects stays **false**. The system does not issue official warnings.

If `alert_context` is empty: *"No official warning available through the current system."*

## Flood-related language

Heavy rainfall is described as a **waterlogging / flood-risk concern** in low-lying or poorly drained areas.

There is **no** `rainfall > X → flood` rule and no flood-prediction model.

## Cyclone-related language

A `cyclone_related` hazard is a **combination** of strong wind + rainfall + low/falling pressure. It does **not** mean a cyclone exists or will make landfall.

## Historical baseline

When coordinates are available, forecast max temperature / rainfall can be compared with ERA5 same-month statistics. Without coordinates the baseline is omitted — mock station climatology is not used.

## Chat / UI

Send `role: "flood_disaster"` on `POST /chat`. Optional extra field `disaster_assessment` (safe for existing MERN clients to ignore) includes hazard type, severity, forecast window, models, agreement, official-warning status, and advisory.

Disaster-oriented questions (severe weather, developing hazards, disaster preparedness) classify as `disaster_risk`. If the UI role is the default `citizen`, that intent activates the Flood & Disaster interpretation for that turn. Farmer / aviation / other selected roles are not stolen.

## Local test

```powershell
cd weathergpt-2
.\.venv\Scripts\python.exe -m pytest tests/test_flood_disaster.py tests/test_nwp.py tests/test_roles.py -q
.\.venv\Scripts\python.exe scripts/test_flood_disaster.py --name Lucknow --also Mumbai Chennai
```

`POST /nwp/hazard-assessment` with `"role": "flood_disaster"` attaches the same structured `disaster_assessment` without a second GFS/ECMWF fetch (NWP cache is shared).
