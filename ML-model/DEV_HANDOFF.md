# WeatherGPT — Full Developer / Agent Handoff Guide

**Audience:** Backend/frontend developers, SIH teammates, or another agentic AI continuing this work.  
**Repo focus:** AI/ML intelligence (`weathergpt-2/`), Node gateway (`backend/`), legacy AI (`gpt-aiml/`), paused ML acquisition (`scripts/`, `data/`).  
**Out of scope for this AI team:** Voice STT/TTS (owned by another team).  
**Last major integrity pass:** September 2026 — removed synthetic climate, inventing AI fallbacks, and demo-alert claims; dual-mounted `/api/v1` on weathergpt-2.

---

## 1. Product principles (non-negotiable)

WeatherGPT must:

1. **Fetch** live meteorological, archive, NWP, or official-alert data when available.
2. **Process** it with transparent rules (risk engine, NWP hazard screen, advisories, roles).
3. **Respond** in natural language (Gemini) **only from that evidence**.

It must **never**:

- Invent temperature, rainfall, wind, AQI, wave height, or official IMD warnings.
- Use demo city bulletins, synthetic climate time series, or “helpful” fake weather when APIs fail.
- Claim flood or cyclone prediction, or replace statutory warnings.
- Present WeatherGPT risk / NWP scores as official IMD products.

**If information is unavailable → return a clear error / unavailable message. Do not fabricate numbers.**

---

## 2. High-level architecture

```text
Frontend (MERN — typically outside this repo)
        │
        ▼
backend/     Node Express — single trusted gateway
        │    weather normalize, alert ingest, auth, chat/risk/advisory proxy
        ▼
weathergpt-2/   FastAPI — PRIMARY AI/ML intelligence service
        │    Gemini + tools + rule engines
        ▼
Live sources
  • Open-Meteo forecast / geocoding / GFS / ECMWF / ERA5 archive
  • Optional IMD (city forecast + district warnings via backend ingest)
```

| Component | Path | Status | Role |
|-----------|------|--------|------|
| **Primary AI service** | `weathergpt-2/` | **Use this** | Chat, roles, risk, advisory, anomaly, climate, NWP, historical |
| Legacy AI service | `gpt-aiml/` | Prefer not | Older stack with `/api/v1` only; overlap with weathergpt-2 |
| Backend gateway | `backend/` | Active | Auth, Mongo/Redis, weather, alerts, AI proxy |
| ML raw acquisition | `scripts/`, `data/` | **Paused** | GFS/ECMWF/GHCN download only — no labels, no training |

---

## 3. Repository map

```text
parentfolder ai-ml/
├── weathergpt-2/          # PRIMARY FastAPI AI service
│   ├── app/
│   │   ├── main.py        # Routes + /api/v1 aliases
│   │   ├── api/           # chat, intelligence, nwp, historical
│   │   ├── services/      # gemini, weather, risk, nwp, roles, …
│   │   ├── tools/         # Gemini function declarations + executor
│   │   ├── ml/            # Rule-based risk, features, anomaly (NOT trained ML)
│   │   ├── models/        # Pydantic request/response schemas
│   │   └── core/          # nwp_config thresholds, exceptions
│   ├── docs/              # Feature-specific markdown
│   ├── tests/
│   ├── Dockerfile
│   └── render.yaml
├── backend/               # Node gateway
│   ├── src/
│   │   ├── services/ai/ai.service.js      # IMPORTANT: changed
│   │   ├── services/climate/climate.service.js  # IMPORTANT: changed
│   │   ├── services/weather/
│   │   ├── services/alerts/
│   │   ├── controllers/
│   │   └── routes/
│   └── src/docs/API_CONTRACT.md
├── gpt-aiml/              # Legacy FastAPI (optional / do not prefer)
├── scripts/               # ML acquisition (paused)
├── data/
│   ├── configs/india_ml_v1.json
│   └── raw/               # GFS/ECMWF/GHCN chunks (incomplete ECMWF OK for now)
└── docs/                  # (this handoff lives at repo root as DEV_HANDOFF.md)
```

---

## 4. Core design: fetch → process → respond

Every user-facing weather answer should follow:

| Stage | What happens | Where |
|-------|----------------|-------|
| **Understand** | Intent, role, language, location | `intent.py`, `request_parser.py`, `language.py`, `entities.py` |
| **Fetch** | Live Open-Meteo / NWP / archive; alerts only from backend | `weather.py`, `nwp.py`, `location.py`, `context.py` |
| **Process** | Risk rules, NWP thresholds, role indicators, advisory builders | `ml/risk_model.py`, `nwp_hazards.py`, `role_pipeline.py`, `advisory.py` |
| **Respond** | Gemini explains structured evidence; does not invent mm/°C | `gemini.py` system rules + tools |

The LLM is **not** a weather model. It is an explainer and router over tools/engines.

---

## 5. Fully implemented features (weathergpt-2)

### 5.1 Natural-language chat

| Item | Detail |
|------|--------|
| Endpoints | `POST /chat`, `POST /api/v1/chat` |
| Code | `app/api/chat.py` → `services/gemini.py` → `chat_with_tools` |
| Needs | `GEMINI_API_KEY` |
| Contract | Required: `response`, `language`, `status`. Optional extras listed below. |

**Optional chat response fields:** `intent`, `role`, `tool_calls`, `risk`, `advisory`, `follow_up_questions`, `confidence`, `latency_ms`, `tts_hint` (for other team’s TTS — not STT), `disaster_assessment`, `historical_analysis`.

### 5.2 Gemini tools

Defined in `app/tools/definitions.py`, executed in `app/tools/executor.py`:

| Tool | Purpose |
|------|---------|
| `search_location` | Place name → lat/lon (Open-Meteo geocoding) |
| `get_current_weather` | Live current conditions |
| `get_forecast` | Multi-day forecast + grounded daily table |
| `get_alerts` | Official alerts **only** if `alert_context` was supplied |
| `get_risk_score` | Multi-hazard 0–100 rule score |
| `get_advisory` | Domain advisory (agriculture / travel / disaster / urban_general) |
| `get_historical_weather` | Past date from archive |
| `get_climate_trend` | Multi-year ERA5 stats |
| `detect_anomaly` | Z-score vs ERA5 same-month normals |
| `get_nwp_hazard_assessment` | GFS+ECMWF 24–48h hazard screen |
| `get_historical_analysis` | ERA5 totals/extremes/multi-city |
| `get_nwp_verification` | Archived GFS/ECMWF vs ERA5 skill |

### 5.3 Live weather & location

| Feature | Endpoint / entry | Source |
|---------|------------------|--------|
| Current weather | tools + `services/weather.py` | Open-Meteo |
| Forecast 1–7 days | `get_forecast` + grounding | Open-Meteo |
| Geocoding | `search_location` / `services/location.py` | Open-Meteo |
| Historical day | `get_historical_weather` | Open-Meteo archive |

### 5.4 Multilingual (text only)

| Item | Detail |
|------|--------|
| Codes | `en`, `hi`, `bn`, `te`, `mr`, `ta`, `ur`, `gu`, `kn`, `ml`, `pa`, `or` |
| Detection | `services/language.py` — Unicode script majority (≥70%) / plurality |
| Aligned with | `backend/src/utils/constants.js` → `SUPPORTED_LANGUAGES` |
| Follow-ups | `services/followups.py` — role + language aware |

Voice input/output is **not** owned here. `tts_hint` is a plain-text hint for client TTS only.

### 5.5 Nine user roles

Enum: `app/services/roles.py` · config: `app/services/role_config.py` · pipeline: `role_pipeline.py`

| Role ID | Label | Focus |
|---------|-------|--------|
| `citizen` | Citizen | Daily life, outdoor, commute |
| `farmer` | Farmer / Crop Advisory | Harvest, spray, irrigation (conditional; asks crop) |
| `researcher` | Researcher | Precise, uncertainty-aware |
| `aviation` | Aviation | Visibility, wind, storms — no absolute go/no-go |
| `marine` | Marine | Wind/sea-state — optional marine API extras |
| `climate_analyst` | Climate Analyst | Short-term vs longer archive context |
| `urban_planner` | Urban Planner | Heat, drainage, events |
| `air_quality` | Air Quality | AQ when available; never invent AQI from weather alone |
| `flood_disaster` | Flood & Disaster | Interprets NWP hazards only; no flood/cyclone claims |

Pipeline: parse request → fetch role variables (`weather_bundle.py`) → indicators (`indicators.py`) → advisory context (`role_advisory.py`) → inject into Gemini.

Disaster-style intents can auto-promote citizen → `flood_disaster`.

### 5.6 Advisories

| Item | Detail |
|------|--------|
| API | `POST /advisory`, `POST /api/v1/advisory` |
| Domains | `agriculture`, `travel`, `disaster`, `urban_general` |
| Code | `services/advisory.py` |
| Rule | Missing live fields → “unavailable” advisory text; no invented °C/mm |

### 5.7 Multi-hazard risk score (alerts + weather → WeatherGPT score)

**This is the feature that combines multiple alert reports with live weather and produces WeatherGPT’s own assessment.**

| Item | Detail |
|------|--------|
| API | `POST /risk/score`, `POST /risk/explain` (+ `/api/v1/...`) |
| Code | `services/risk.py` → `ml/risk_model.py` (`RuleBasedRiskEngine`, `rule-v1`) |
| Features | `ml/features.py` |

**Hazards:** `heat`, `heavy_rain`, `thunderstorm`, `high_wind`, `fog_visibility`, `cold_wave`, `composite`.

**How alerts are used:**

1. Caller passes `alert_context: [ {...}, {...} ]` (from backend IMD ingest / DB).
2. `FeatureExtractor` maps each alert severity `GREEN|YELLOW|ORANGE|RED` → 0–3 and keeps the **max** as `official_warning_severity`.
3. Weighted meteorological features produce a raw 0–100 score.
4. If matching alerts exist, score is **floored**: RED ≥ 88, ORANGE ≥ 65, YELLOW ≥ 40.
5. Response includes `official_warning`, `official_warning_details`, factors, explanation.

**Important:** Alert *content* is never invented. The *score formula* is WeatherGPT’s (prototype rules), not an IMD statute.

Threshold *labels* used in explanations (e.g. heat ~40–42°C, rain ~15 mm/h) are internal screening strings in `risk_model.py`, not official IMD warning criteria.

### 5.8 NWP GFS + ECMWF hazard assessment

| Item | Detail |
|------|--------|
| API | `POST /nwp/hazard-assessment` (+ `/api/v1/...`) |
| Code | `services/nwp.py`, `nwp_hazards.py`, `core/nwp_config.py` |
| Docs | `weathergpt-2/docs/NWP_HAZARD_ALERTS.md`, `FLOOD_DISASTER.md` |

**Pipeline:** lat/lon → fetch GFS + ECMWF hourly (~48h) → window stats → rule screens → **model agreement** (high/moderate/low) → severity → role advisory text.

**Hazard types (screening only):** heavy_rain, strong_wind, convective/CAPE environment, extreme_heat, cyclone_related (combined wind+rain+pressure — does **not** identify a cyclone).

**Thresholds:** `HAZARD_THRESHOLDS` in `nwp_config.py` (e.g. 24h rain bands ~30 / 64.5 / 115.6 / 204.5 mm). Documented as prototype — **not** official IMD criteria. Overridable via env `NWP_THRESHOLD_<NAME>`.

`official_warning` on NWP objects is always `false`. Official warnings come only from `alert_context`.

### 5.9 Climate, anomaly, historical analysis

| Feature | Endpoint | Source |
|---------|----------|--------|
| Climate analyze | `POST /climate/analyze` | Live ERA5 via Open-Meteo archive |
| Anomaly detect | `POST /anomaly/detect` | Live obs vs ERA5 same-month stats |
| Historical analysis | `POST /climate/historical-analysis` | ERA5 totals, extremes, multi-city |
| NWP verification | `POST /climate/nwp-verification` | Previous-runs GFS/ECMWF vs ERA5 |

Docs: `weathergpt-2/docs/HISTORICAL_ANALYSIS.md`.

### 5.10 Forecast grounding

`services/forecast_grounding.py` builds a verified multi-day table so Gemini cannot invent weekly rainfall trends. Optional IMD city forecast is attempted (`imd_forecast.py`) and marked unavailable if the API/key/whitelist fails — **no fake IMD numbers**.

### 5.11 Service meta

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness |
| `GET /` | Route index |
| `GET /model-info` | Engines, roles, languages, MERN field contract |
| `GET /docs` | OpenAPI UI |

All intelligence routes are mounted **twice**: unprefixed and under `/api/v1` (see §7).

---

## 6. What is NOT implemented / paused

| Item | Status |
|------|--------|
| Voice STT / full TTS engine | Other team (`tts_hint` only) |
| Supervised ML rainfall-event model | **Paused** — raw acquisition partial; no labels, features, train/test, or trained artifact |
| Invented demo alerts (Lucknow/Delhi/Mumbai) | **Removed** from runtime; docs updated |
| Synthetic backend climate series | **Removed** |
| Local inventing chat/risk/advisory when AI is down | **Removed** |

### ML acquisition snapshot (for awareness only)

- Config: `data/configs/india_ml_v1.json`
- Run: `20260918T131440Z`
- GFS: largely complete Feb 2024–Sep 2026 (one incomplete chunk Oct–Nov 2025)
- ECMWF: complete through ~2024-11-05; later incomplete/missing (rate limit)
- GHCN: 138 stations, ~21k PRCP rows through ~2025-08-24
- Common usable overlap for training later: ~2024-02-01 → 2024-11-05
- **Do not resume ML downloads unless product asks again**

---

## 7. API path compatibility (critical for backend)

`weathergpt-2` exposes **both**:

| Unprefixed | `/api/v1` alias |
|------------|-----------------|
| `POST /chat` | `POST /api/v1/chat` |
| `POST /risk/score` | `POST /api/v1/risk/score` |
| `POST /advisory` | `POST /api/v1/advisory` |
| `POST /anomaly/detect` | `POST /api/v1/anomaly/detect` |
| `POST /climate/analyze` | `POST /api/v1/climate/analyze` |
| `POST /nwp/hazard-assessment` | `POST /api/v1/nwp/hazard-assessment` |
| `POST /climate/historical-analysis` | `POST /api/v1/climate/historical-analysis` |
| `POST /climate/nwp-verification` | `POST /api/v1/climate/nwp-verification` |
| `GET /model-info` | `GET /api/v1/model-info` |

Implemented in `weathergpt-2/app/main.py` by including routers twice (plain + `prefix="/api/v1"`).

**Backend `ai.service.js` tries unprefixed first, then `/api/v1`**, so it works with weathergpt-2 and legacy gpt-aiml.

---

## 8. Backend changes (read carefully — update your own backend to match)

These changes live under `backend/` in this repo. If you maintain a separate backend fork, **port the same behavior**.

### 8.1 `src/services/ai/ai.service.js` — rewritten behavior

**Before (bad):** On AI failure, locally synthesized risk / advisory / chat from partial fields (and sometimes implied “normal” conditions).

**After (required):**

1. `_postAi(paths, payload)` tries each path in order; if all fail → throw `ApiError.aiServiceError` with a clear message. **No inventing fallback.**
2. `calculateRisk` → `POST /risk/score` then `/api/v1/risk/score`. If `available === false` or `score == null` → error.
3. `generateAdvisory` → `/advisory` then `/api/v1/advisory`. Treats “unavailable” titles/summaries as errors.
4. `generateChatResponse` → `/chat` then `/api/v1/chat`. Empty message → error. **No template weather sentence fallback.**

**What your backend must do:**

- Set `AI_SERVICE_URL` to the **weathergpt-2** deployment URL (not an outdated aiml hostname unless that host actually serves weathergpt-2).
- Set `MOCK_EXTERNAL_APIS=false` in production.
- Propagate `ApiError` (502) to the client as a clear “AI/weather unavailable” UX — do not invent an answer in the controller.

### 8.2 `src/services/climate/climate.service.js` — rewritten behavior

**Before (critical bug):** If Mongo had no history, `generateHistoricalSeries()` invented temps/precip with `Math.sin` / `Math.random` and labeled source `IMD-Climate-Archive`.

**After (required):**

1. Try Mongo `HistoricalWeather` for the bbox/date range.
2. Else fetch **live** Open-Meteo archive: `https://archive-api.open-meteo.com/v1/archive` (ERA5 daily).
3. If both fail → `ApiError.providerTimeout` with message that values are not invented.
4. Trends computed only from real points; no fabricated p-values or fake IMD branding.

**Source strings now:** `MongoDB-HistoricalWeather` or `Open-Meteo Historical Weather API (ERA5)`.

### 8.3 `src/controllers/risk.controller.js`

- Comment/clarified: risk comes from AI service only (no local invented fallback).
- Response includes `available`, `explanation`, `officialWarning` when provided by AI.

### 8.4 Weather / alerts (already aligned directionally)

| File | Behavior to preserve |
|------|----------------------|
| `services/weather/providers/imd.provider.js` | Try IMD; fall back to **live Open-Meteo**; never fabricate. `MOCK_EXTERNAL_APIS` refuses fake weather. |
| `services/weather/providers/openmeteo.provider.js` | Live current/hourly/daily |
| `services/alerts/alertIngestion.service.js` | Live IMD district warnings; if none → empty, **do not invent** |
| `seeds/seedData.js` | No fabricated climate seed; optional live alert ingest |

### 8.5 Env vars your backend must set

| Variable | Purpose |
|----------|---------|
| `AI_SERVICE_URL` | Base URL of **weathergpt-2** (e.g. `https://<your-weathergpt-ai>.onrender.com`) |
| `AI_SERVICE_API_KEY` | Optional shared secret header |
| `MONGODB_URI` | Required in production |
| `JWT_SECRET` | Strong secret (do not use code defaults in prod) |
| `MOCK_EXTERNAL_APIS` | `false` in production |
| `IMD_BASE_URL` / `IMD_API_KEY` | Optional; alerts/weather degrade cleanly without them |
| `CORS_ORIGINS` | Your frontend origin(s) |

**Note:** This repo’s `backend/.env.example` and `render.yaml` may still show an old `weathergpt-aiml.onrender.com` hostname. **Point production at the weathergpt-2 service you actually deploy.**

### 8.6 How backend should call AI (examples)

```http
POST {AI_SERVICE_URL}/chat
Content-Type: application/json

{
  "message": "Will it rain tomorrow in Lucknow?",
  "role": "farmer",
  "location": { "name": "Lucknow", "lat": 26.8467, "lon": 80.9462 },
  "alert_context": []
}
```

```http
POST {AI_SERVICE_URL}/risk/score
Content-Type: application/json

{
  "hazard": "composite",
  "location": { "name": "Mumbai", "lat": 19.076, "lon": 72.8777 },
  "weather_context": { "...live fields..." },
  "forecast_context": [ ... ],
  "alert_context": [ { "severity": "ORANGE", "headline": "...", "hazard": "heavy_rain" } ]
}
```

Equivalent `/api/v1/...` paths are supported.

### 8.7 Passing official alerts

1. Backend ingests IMD (or other official) alerts into Mongo.
2. For the user’s location, load active alerts.
3. Pass them as `alert_context` on `/chat`, `/risk/score`, `/advisory`.
4. If the list is empty, AI reports **no official warning available** — it will not invent Lucknow/Delhi/Mumbai demo bulletins.

---

## 9. Frontend / MERN team checklist

1. Call **backend** for weather/auth/chat history; do not embed Gemini keys in the browser.
2. Send `role` from the UI role selector (`citizen` … `flood_disaster`).
3. Send GPS as `location: { lat, lon, name? }` when available.
4. Display `status: ok` answers; on 502/504 show the error message (unavailable), not a fake weather card.
5. Optional: render `disaster_assessment`, `risk`, `follow_up_questions`, `tts_hint` (voice team).
6. Never display WeatherGPT risk as “IMD Red Alert” unless `official_warning` / alert payload says so.

---

## 10. Deployment notes

### weathergpt-2
- `Dockerfile`, `render.yaml` present.
- Required: `GEMINI_API_KEY` (for chat). Intelligence engines can run without Gemini.
- Health: `GET /health`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### backend
- Needs MongoDB (+ Redis optional with in-memory fallback).
- Must set `AI_SERVICE_URL` to weathergpt-2.
- Health: `GET /health`, readiness: `GET /ready`

### Smoke test after deploy
1. Backend + AI `/health`
2. Current weather for a lat/lon
3. `POST /chat` with a simple forecast question
4. `POST /risk/score` with coordinates
5. `POST /nwp/hazard-assessment`
6. Climate history: expect ERA5 data or a **clear error** (never random series)

---

## 11. Related docs in-repo

| Doc | Path |
|-----|------|
| MERN integration | `weathergpt-2/docs/MERN_INTEGRATION.md` |
| AI overview | `weathergpt-2/docs/AI_SERVICE_OVERVIEW.md` |
| NWP hazards | `weathergpt-2/docs/NWP_HAZARD_ALERTS.md` |
| Flood & Disaster | `weathergpt-2/docs/FLOOD_DISASTER.md` |
| Historical analysis | `weathergpt-2/docs/HISTORICAL_ANALYSIS.md` |
| Testing | `weathergpt-2/docs/TESTING.md` |
| Backend API contract | `backend/src/docs/API_CONTRACT.md` |
| AI README | `weathergpt-2/README.md` |
| Backend README | `backend/README.md` |

Prefer **this handoff** + the feature docs above over outdated comments that once mentioned “demo alerts.”

---

## 12. Integrity rules for future agents / PRs

Before merging any weather-related change, verify:

- [ ] No `Math.random` / sine-wave / hardcoded city climatology as production data.
- [ ] No demo alert JSON for Lucknow/Delhi/Mumbai in runtime paths.
- [ ] AI/backend failure paths return errors, not invented forecasts.
- [ ] Risk/NWP outputs labeled as WeatherGPT screening, not official warnings.
- [ ] Flood & Disaster never claims “a flood will occur” / evacuation orders.
- [ ] New endpoints documented; `/api/v1` alias added if backend will call them.
- [ ] ML training not claimed unless labels + features + metrics exist under `data/processed/`.

---

## 13. Quick file index for common tasks

| Task | Start here |
|------|------------|
| Change chat behavior / prompts | `weathergpt-2/app/services/gemini.py` |
| Add a Gemini tool | `tools/definitions.py` + `tools/executor.py` |
| Change risk formula | `ml/risk_model.py`, `ml/features.py` |
| Change NWP thresholds | `core/nwp_config.py` |
| Add a role | `roles.py`, `role_config.py`, `followups.py` |
| Backend AI proxy | `backend/src/services/ai/ai.service.js` |
| Backend climate history | `backend/src/services/climate/climate.service.js` |
| Alert ingest | `backend/src/services/alerts/alertIngestion.service.js` |

---

## 14. One-paragraph summary for another AI

WeatherGPT’s deployable product is **weathergpt-2** (FastAPI) behind **backend** (Node). Chat uses Gemini with live Open-Meteo tools; risk and NWP are rule engines over live weather and optional official `alert_context`; climate/history use ERA5 archive. The project was cleaned so **unavailable data yields errors**, not synthetic IMD climate or local inventing chat/risk fallbacks. Dual routes (`/` and `/api/v1`) keep MERN proxies working. Supervised rainfall ML is paused with partial GFS/ECMWF/GHCN raw data only. Voice is out of scope. Any new feature must fetch real data, process transparently, and never invent meteorological figures.
