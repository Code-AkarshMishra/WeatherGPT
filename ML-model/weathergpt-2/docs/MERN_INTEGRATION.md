# MERN Integration Guide — WeatherGPT AI Service

## What this service is

WeatherGPT AI is a standalone FastAPI service.

- It understands natural-language weather questions (English + major Indian languages)
- It auto-detects language (whichever language covers ≥70% of the prompt wins)
- It adapts answers to the UI `role` persona (citizen, farmer, aviation, …)
- It uses Gemini tool calling
- It fetches real location/weather data from Open-Meteo
- It also exposes risk, advisory, anomaly, and climate engines
- It returns a short natural-language answer for chat

It does **not** handle:
- login/auth
- chat history storage
- MongoDB
- UI

Those stay in the MERN app.

## Base URL

**Production (Render):**

`https://weathergpt-jdqt.onrender.com`

**Local:**

`http://127.0.0.1:8000`

## Start the AI service

```bash
python -m venv .venv
# Windows:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # then put GEMINI_API_KEY in .env
uvicorn app.main:app --reload
```

Health check: `GET http://127.0.0.1:8000/health`

Interactive API docs: `http://127.0.0.1:8000/docs`

## Chat API (unchanged MERN contract)

### Endpoint

`POST /chat`  
Header: `Content-Type: application/json`

### Request

```json
{
  "message": "Will it rain tomorrow in Lucknow?",
  "location": {
    "lat": 26.8467,
    "lon": 80.9462
  }
}
```

| Field | Required | Description |
|--------|----------|-------------|
| `message` | Yes | User text (English or Indian languages). Min length 1. |
| `location` | No | Device/user coordinates from the client app |
| `location.lat` | If location sent | Latitude |
| `location.lon` | If location sent | Longitude |
| `location.name` | No | Optional place name |
| `role` | No | UI persona: `citizen`, `farmer`, `researcher`, `aviation`, `marine`, `climate_analyst`, `urban_planner`, `air_quality`, `flood_disaster` |
| `alert_context` | No | Later: official IMD alerts from the Node backend |

**Do not send a language field.** Language is auto-detected from `message` (whichever language covers ≥70% of letters wins).

### Success response

```json
{
  "response": "Rain is likely tomorrow in Lucknow. Carry an umbrella.",
  "language": "en",
  "status": "ok"
}
```

Existing MERN code can keep using only `response`, `language`, and `status`. Extra fields below are optional and safe to ignore.

| Field | Meaning |
|--------|---------|
| `response` | Text to show in chat UI |
| `language` | `en`, `hi`, `bn`, `te`, `mr`, `ta`, `ur`, `gu`, `kn`, `ml`, `pa`, or `or` |
| `status` | `"ok"` on success |
| `intent` | Optional label (`forecast`, `advisory_request`, …) |
| `role` | Echo of the persona used for this answer |
| `tool_calls` | Optional list of tools Gemini used |
| `risk` | Optional structured risk object if that tool ran |
| `advisory` | Optional structured advisory if that tool ran |
| `tts_hint` | Optional plain text for later client-side TTS |
| `disaster_assessment` | Optional Flood & Disaster badges: hazards, severity, models, agreement, official-warning status |
| `historical_analysis` | Optional ERA5 stats, city comparison, chart series, NWP verification |

### Validation error example

Empty `message` → HTTP `422`.

### AI unavailable example

Gemini quota/outage → HTTP `503` with an error payload.

## Extra endpoints (MERN widgets / dashboards)

These do **not** need Gemini. The Node backend can call them for cards, farmer advisories, or risk badges.

- `GET /model-info`
- `POST /risk/score`
- `POST /risk/explain`
- `POST /advisory`
- `POST /anomaly/detect`
- `POST /nwp/hazard-assessment`
- `POST /climate/historical-analysis`
- `POST /climate/nwp-verification`

Location on these routes can be `{ "name": "Lucknow" }` and/or `{ "lat": ..., "lon": ... }`.

If you already fetched weather in Node, send it as `weather_context` so the AI service does not call Open-Meteo again.

If the MERN backend ingests IMD alerts, send them as `alert_context` (chat and intelligence routes both accept this). If none are supplied, WeatherGPT reports that official warnings are unavailable — it does **not** invent or attach demo city bulletins.

## Location behavior (important)

Priority:

1. Place name in the user message (e.g. Lucknow)
2. Else `location.lat` / `location.lon` from client
3. Else AI asks: which location to check?

## Example Node.js call

```js
const res = await fetch("http://127.0.0.1:8000/chat", {
  method: "POST",
  headers: { "Content-Type": application/json },
  body: JSON.stringify({
    message: "Will it rain tomorrow in Lucknow?",
    location: { lat: 26.8467, lon: 80.9462 },
  }),
});

const data = await res.json();
if (!res.ok) {
  // handle data.error / validation errors
} else {
  // show data.response in UI
  // optional: use data.language, data.intent, data.risk
}
```

## Ownership split

| MERN team | AI service (this repo) |
|-----------|-------------------------|
| UI / UX | `/chat`, `/health`, intelligence APIs |
| Auth / users | Gemini + tool calling |
| Chat history DB (MongoDB) | Location + weather APIs |
| App routing | EN/HI response behavior |
| Later: live IMD ingest | Risk / advisory / anomaly / climate engines |

## What the AI service currently supports

- Current weather
- Forecast
- Location search/geocoding
- Natural-language questions
- Tool calling
- English + Hindi
- Basic + structured advisories
- Multi-hazard risk scores
- Anomaly vs ERA5 same-month statistics
- Climate / multi-year ERA5 statistics (no fabricated p-values or decade trends)
- Official alerts via `alert_context` from MERN (never invented)
- GFS + ECMWF NWP hazard assessment (`POST /nwp/hazard-assessment`) — not official warnings

## Planned later (not in this service yet)

- Richer live IMD CAP / WIS2 alert coverage (backend already can ingest and pass `alert_context`)
- Voice STT/TTS (client / other team)
- Running WRF locally / custom GFS ingest (Open-Meteo GFS+ECMWF NWP screen is live)
## Notes / limits

- Free-tier Gemini keys can hit rate limits (`429`/`503`)
- Weather facts come from live Open-Meteo / NWP / historical APIs; the LLM should not invent weather
- Official warnings come only from backend `alert_context` when configured — never from mock JSON
- Service is mostly stateless; store history in MERN if needed
- Climate statistics are computed from ERA5 via Open-Meteo archive (not bundled demo normals)
