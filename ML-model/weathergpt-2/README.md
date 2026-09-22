# WeatherGPT AI Service

Standalone FastAPI service for conversational weather intelligence (SIH 2026).

This service is called by the MERN application over HTTP. MongoDB, auth, and chat history stay in the MERN backend.

## Features

### Already in this service (chat / live weather)
- Natural-language weather chat (`POST /chat`) — MERN contract unchanged: `{ response, language, status }`
- Gemini tool calling
- English + Hindi auto-detection
- Multilingual Indian languages (hi/bn/te/mr/ta/ur/gu/kn/ml/pa/or) with 70% majority-language rule
- Role personas via `role` on `/chat` (citizen, farmer, researcher, aviation, marine, climate_analyst, urban_planner, air_quality, flood_disaster)
- NWP hazard screen (`POST /nwp/hazard-assessment`) — GFS + ECMWF via Open-Meteo, rules-based, not official warnings
- Flood & Disaster role — interprets the NWP assessment for developing hazards (not flood/cyclone prediction)
- Location geocoding (Open-Meteo)
- Current weather + 1–7 day forecast (Open-Meteo)
- Optional client GPS (`location.lat` / `location.lon`)

### Newly imported from gpt-aiml (working now)
- Multi-hazard risk engine (`POST /risk/score`) — heat, heavy rain, thunderstorm, high wind, fog, cold wave, composite
- Domain advisories (`POST /advisory`) — agriculture, travel, disaster, urban
- Anomaly detection (`POST /anomaly/detect`) — z-score vs monthly ERA5 normals
- Climate trend narrative (`POST /climate/analyze`) — ERA5 multi-year statistics (not fabricated decade trends)
- Historical weather for a past date **and multi-year ERA5 analysis** (`POST /climate/historical-analysis`)
- GFS/ECMWF previous-run verification vs ERA5 (`POST /climate/nwp-verification`)
- Official alerts only via backend `alert_context` (never invented or demo-filled)
- Optional extra `/chat` fields MERN can ignore: `intent`, `tool_calls`, `risk`, `advisory`, `tts_hint`, `disaster_assessment`

## Setup

1. Create and activate a virtual environment
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and set:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

`GEMINI_API_KEY` is only required for `POST /chat`. Risk / advisory / anomaly / climate endpoints run without it.

4. Run:

```bash
uvicorn app.main:app --reload
```

Service: `http://127.0.0.1:8000`  
Docs: `http://127.0.0.1:8000/docs`

## Quick API

| Method | Path | Needs Gemini? | Notes |
|--------|------|---------------|--------|
| GET | `/health` | No | Liveness |
| GET | `/model-info` | No | Engine inventory for MERN |
| POST | `/chat` | Yes | Conversational answer |
| POST | `/risk/score` | No | 0–100 hazard score |
| POST | `/risk/explain` | No | Human-readable risk breakdown |
| POST | `/advisory` | No | Structured domain advice |
| POST | `/anomaly/detect` | No | Unusual vs normal |
| POST | `/climate/analyze` | No | ERA5 multi-year climate statistics |

## Automated tests (no Gemini key)

```bash
pip install -r requirements.txt
python -m pytest -v tests
```

## Docs for teammates

- [MERN Integration Guide](docs/MERN_INTEGRATION.md)
- [AI Service Overview](docs/AI_SERVICE_OVERVIEW.md)
- [NWP hazard alerts](docs/NWP_HAZARD_ALERTS.md)
- [Flood & Disaster role](docs/FLOOD_DISASTER.md)
- [Historical / climate analysis](docs/HISTORICAL_ANALYSIS.md)

## Deploy (Render free tier)

Same as before. Also copy `data/` (Docker already does). Set `GEMINI_API_KEY`.

MERN should call either:

`POST https://<your-render-url>/chat`  
or  
`POST https://<your-render-url>/api/v1/chat`  

(Same handlers; `/api/v1/*` matches the Node `ai.service.js` client.)
