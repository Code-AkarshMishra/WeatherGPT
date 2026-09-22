# WeatherGPT AI — Overview

## Architecture

```text
MERN app (UI, auth, MongoDB, chat history)
   │  POST /chat
   │  POST /risk/score  (optional widgets)
   │  POST /advisory
   │  POST /nwp/hazard-assessment
   ▼
FastAPI AI service
    ├── Gemini (understand question, choose tools, write answer)
    ├── Location API (Open-Meteo Geocoding)
    ├── Weather API (Open-Meteo current / forecast / archive)
    ├── NWP APIs (Open-Meteo GFS + ECMWF IFS) → hazard screen
    ├── Flood & Disaster role (interprets NWP; not flood prediction)
    ├── Risk engine (rule-v1)
    ├── Advisory engine (agri / travel / disaster / urban)
    ├── Anomaly engine (z-score vs live ERA5 same-month stats)
    └── Climate engine (ERA5 multi-year archive statistics)
```

## Request flow (chat)

1. User asks a weather question in the MERN UI
2. MERN sends `{ message, location? }` to AI service
3. Gemini may call tools:
   - `search_location`
   - `get_current_weather`
   - `get_forecast`
   - `get_alerts`
   - `get_risk_score`
   - `get_advisory`
   - `get_historical_weather`
   - `get_climate_trend`
   - `get_nwp_hazard_assessment`
4. Python executes tools (live APIs + engines; official alerts only from `alert_context`)
5. Gemini returns a natural answer
6. AI service responds with `{ response, language, status }` plus optional extras

## Design principles

- LLM is not a weather model
- Weather facts come from meteorological/weather APIs
- Location logic is separate from weather logic
- Tools are separate from HTTP routes
- MongoDB stays in MERN; this service is stateless
- Extra JSON fields on `/chat` must not break existing MERN clients
