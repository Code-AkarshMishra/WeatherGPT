# How to test WeatherGPT AI (weathergpt-2)

Do this **before** building unimplemented features (live IMD, voice STT/TTS, WRF execution).

## 0. One-time setup

```powershell
cd "c:\Users\91930\OneDrive\Desktop\parentfolder ai-ml\weathergpt-2"
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

You already have `.env` with `GEMINI_API_KEY` if chat was working before.

## 1. Automated tests (no live Gemini, no MERN)

These prove the imported engines and HTTP contracts:

```powershell
python -m pytest -v tests
```

Expected: all tests pass.

What this covers:
- Risk engine (heavy rain / heat / calm / Open-Meteo field aliases)
- Agriculture + travel advisories
- Temperature anomaly z-score
- Climate statistics for Lucknow from ERA5 archive
- Intent labels (English + Hindi)
- `GET /health`, `GET /model-info`
- `POST /risk/score`, `/advisory`, `/anomaly/detect`, `/climate/analyze`, `/nwp/hazard-assessment`
- GFS/ECMWF parsing, rainfall windows, wind screen, model agreement (no live NWP required)
- Flood & Disaster role interpretation (no second NWP fetch; official vs NWP split)
- Historical ERA5 stats, multi-city comparison, previous-run MAE (mocked HTTP)
- `/chat` still rejects empty `message` with HTTP 422 (MERN contract)

## 2. Start the service

```powershell
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs and try the endpoints there, or use the curls below.

## 3. Endpoints that do **not** need Gemini

### Health
```powershell
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/model-info
```

### Risk (uses the weather you send — no live API)
```powershell
curl -X POST http://127.0.0.1:8000/risk/score -H "Content-Type: application/json" -d "{\"hazard\":\"heavy_rain\",\"location\":{\"name\":\"Lucknow\"},\"weather_context\":{\"rainfall_rate\":18,\"precipitation_probability\":90,\"wind_gust\":42},\"forecast_context\":[],\"alert_context\":[{\"hazard\":\"heavy_rain\",\"severity\":\"ORANGE\",\"headline\":\"Orange Alert: Heavy Rain\"}]}"
```

You should see `"score"` around 60–100 and `"level": "HIGH"` or `"EXTREME"`.

### Agriculture advisory
```powershell
curl -X POST http://127.0.0.1:8000/advisory -H "Content-Type: application/json" -d "{\"domain\":\"agriculture\",\"location\":{\"name\":\"Lucknow\"},\"weather_context\":{\"rainfall_rate\":12,\"precipitation_probability\":80,\"temperature\":32},\"forecast_context\":[],\"alert_context\":[]}"
```

Look for a recommendation to postpone spraying.

### Anomaly (hot vs September normal)
```powershell
curl -X POST http://127.0.0.1:8000/anomaly/detect -H "Content-Type: application/json" -d "{\"location\":{\"name\":\"Lucknow\",\"lat\":26.85,\"lon\":80.95},\"metric\":\"temperature\",\"observed_values\":{\"temperature\":36.5},\"month\":9}"
```

`"is_anomaly": true` and a high z-score.

### Climate trend (live ERA5)
```powershell
curl -X POST http://127.0.0.1:8000/climate/analyze -H "Content-Type: application/json" -d "{\"location\":{\"name\":\"Lucknow\"},\"metric\":\"temperature\"}"
```

Returns multi-year ERA5 archive statistics for the place (or a clear unavailable error). Not demo JSON.

### Live weather risk (needs internet, not Gemini)
```powershell
curl -X POST http://127.0.0.1:8000/risk/score -H "Content-Type: application/json" -d "{\"hazard\":\"composite\",\"location\":{\"name\":\"Mumbai\",\"lat\":19.076,\"lon\":72.8777}}"
```

This geocodes if needed, pulls Open-Meteo current+forecast, then scores. Official alerts attach only if you pass `alert_context`.

### Flood & Disaster NWP interpretation (needs internet for live models)

```powershell
python scripts/test_flood_disaster.py --name Lucknow --also Mumbai Chennai
```

Looks for developing hazards from GFS/ECMWF (cached). Does not claim floods or official warnings.

### Historical analysis / NWP verification (needs internet)

```powershell
python scripts/test_historical_analysis.py --message "last 5 years" --name Lucknow
python scripts/test_historical_analysis.py --message "Compare rainfall in Lucknow and Kanpur over the last 5 years."
python scripts/test_nwp_verification.py --name Lucknow --message "last 90 days"
```

## 4. Chat tests (needs Gemini + internet)

MERN contract is unchanged. Extra fields are optional.

English:
```powershell
curl -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"Will it rain tomorrow in Lucknow?\",\"location\":{\"lat\":26.8467,\"lon\":80.9462}}"
```

Hindi (existing helper script, safer than typing Hindi in PowerShell):
```powershell
python scripts/test_hindi_chat.py
```

Try these chat prompts after the server is up:
- `What is the weather in Pune right now?` — location + current weather
- `Should farmers around Lucknow spray pesticide today?` — should call `get_advisory`
- `Is there a flood or heavy-rain risk in Mumbai?` — should call `get_risk_score` / `get_alerts`
- `Are there any disaster risks developing in Lucknow?` with `"role":"flood_disaster"` — NWP assessment + disaster advisory, not a flood prediction
- `How has Lucknow climate changed over decades?` — `get_climate_trend` / historical analysis (ERA5 multi-year record; no fabricated climate-change claim)
- `Is 36 degrees unusual for Lucknow in September?` — `detect_anomaly`

In the JSON, check:
- `response` and `language` (what MERN already uses)
- `status: "ok"`
- `tool_calls` lists tools used
- `intent` is a label like `forecast` / `advisory_request`

If Gemini is rate-limited you get HTTP 503. Intelligence endpoints still work.

## 5. What is live vs unavailable (so you don't mis-test)

| Data | Source |
|------|--------|
| Current weather / forecast | Live Open-Meteo |
| Place-name geocoding | Live Open-Meteo |
| Historical date / multi-year climate | Live Open-Meteo ERA5 archive |
| Official alerts | Only if MERN sends `alert_context`; otherwise unavailable (not invented) |
| Climate normals / trends | Live ERA5 same-month / multi-year archive |
| Risk / advisory math | Real engines fed by live data above |

## 6. Frontend / backend folders

Not required for this step. `/chat` and `/api/v1/chat` both accept `{ message, location: { lat, lon } }` and return `{ response, language, status }`. Wire MERN `alert_context` from live IMD ingest when available — never from demo city bulletins.
