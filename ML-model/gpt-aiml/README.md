# WeatherGPT — AI/ML Intelligence Service
**SIH Problem Statement 26068 | Python + FastAPI | LLM Tool-Calling + Grounded Meteorological Intelligence**

WeatherGPT AI/ML Service is an independent, high-performance intelligence layer built with FastAPI and Python. It consumes trusted meteorological context from the Node.js backend, executes deterministic and ML-powered weather tools, computes transparent multi-hazard risk scores, detects statistical climatological anomalies, generates domain-specific actionable advisories, and synthesizes grounded natural language responses in English and Hindi with strict anti-hallucination guardrails.

---

## 🏗️ Architecture Overview

```
Frontend (React/Vite)
        │
        ▼
Node/Express Backend  (Trust Boundary: Auth, Rate-limiting, Cache, Public APIs)
        │
        ▼  [Trusted AI Request + Weather Context Package]
FastAPI AI Service (:8000)
   ├── 🛡️  Request Validator & Schema Enforcer (Pydantic v2)
   ├── 🎯  Intent Classifier & Multilingual Entity Extractor
   ├── 🧭  Tool Router & Orchestrator
   ├── ⚡  Deterministic Meteorological Tools (Current, Forecast, Alerts, History, Climate)
   ├── ⚠️   Multi-Hazard Risk Engine (`rule-v1` + ML Feature Pipeline)
   ├── 📊  Statistical Anomaly Engine (Z-score & Gaussian Percentiles)
   ├── 🌾  Domain Advisory Engine (Agriculture, Travel, Disaster, Urban)
   ├── 🔑  Gemini Adapter (Multi-Key Rotation, Cooldowns, Exponential Backoff)
   ├── 🛡️  Grounding & Anti-Hallucination Guardrails
   └── 🌐  Multilingual Output Engine (English + Hindi)
```

---

## 🌟 Key Features

1. **Strict Meteorological Grounding & Anti-Hallucination**:
   - Zero free-form hallucinations; answers are grounded exclusively in retrieved numerical observations and official alerts.
   - Distinct isolation between **Official IMD Warnings** (authoritative alerts) and **AI Risk Estimates** (decision support).
   - Traceable data citations with observation station, timestamp, and provider provenance.

2. **Enterprise Gemini Adapter & Multi-Key Failover**:
   - Rotates between `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, and `GEMINI_API_KEY_3`.
   - Automatic circuit breaking and cooldown on HTTP 429 / Quota Exhaustion.
   - Bounded retries with exponential backoff (`tenacity`).
   - Secret masking filter ensures raw API keys are never written to logs.
   - Built-in deterministic fallback synthesizer when `MOCK_MODE=true` or keys are unconfigured.

3. **Multi-Hazard Risk Engine (`rule-v1`)**:
   - Evaluates: `heat`, `heavy_rain`, `thunderstorm`, `high_wind`, `fog_visibility`, `cold_wave`, and `composite`.
   - 14+ normalized meteorological features (`temperature`, `feels_like`, `rainfall_rate`, `wind_gust`, `pressure`, etc.).
   - Produces continuous score (0-100), categorical risk level (`LOW`, `MODERATE`, `HIGH`, `EXTREME`), and ranked contributing factors.

4. **Climatological Anomaly & Trend Analytics**:
   - Computes standardized Z-Scores ($z = (x - \mu)/\sigma$) and Gaussian percentiles against 30-year IMD climatological normals.
   - Multi-decadal linear regression & trend attribution without conflating short-term weather anomalies with climate change.

5. **Actionable Domain Advisories**:
   - **Agriculture**: Rain wash-off risk, pesticide spraying windows, irrigation suspension, and standing crop protection.
   - **Travel**: Highway visibility, fog speed restrictions, and waterlogging delays.
   - **Disaster**: Immediate storm shelter instructions and civil defense alignment.
   - **Urban / General**: Daily commute, UV index protection, and umbrella recommendations.

6. **Multilingual Intelligence (English + Hindi)**:
   - Supports natural language input and output in English and Hindi.
   - Accurately preserves numerical values, units (°C, mm, km/h), station names, and alert levels across translation.

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Python 3.10+
- `pip` package manager

### 2. Installation
```powershell
# Clone the repository
cd weatherGPT-AIML

# Create and activate virtual environment (optional)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Configure your settings in `.env`:
```env
APP_ENV=development
PORT=8000
LOG_LEVEL=INFO
MOCK_MODE=true

# Optional live Gemini keys (multi-key pool)
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
GEMINI_MODEL=gemini-1.5-flash

# Backend Internal Trust Secret
INTERNAL_API_SECRET=sih-weathergpt-internal-secret-2026
```

### 4. Run the Service
```powershell
uvicorn app.main:app --reload --port 8000
```
- API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Alternative Docs: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- Service Health: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 📡 Internal AI/ML API Contracts

### 1. Grounded Chat
`POST /api/v1/chat`

**Request:**
```json
{
  "message": "Will it rain tomorrow in Lucknow and should I carry an umbrella?",
  "location": {
    "name": "Lucknow",
    "lat": 26.85,
    "lon": 80.95
  },
  "language": "en"
}
```

**Response:**
```json
{
  "answer": "Current weather in Lucknow is 34.5°C with Heavy Rain and Thunderstorm. Active rainfall rate is 12.5 mm/h (PoP: 85%). Official IMD Orange Warning in effect.",
  "intent": "advisory_request",
  "language": "en",
  "sources": [
    {
      "title": "Surface Meteorological Station",
      "provider": "IMD_Lucknow_Station_42182",
      "station_or_model": "Lucknow",
      "timestamp": "2026-09-11T14:00:00Z"
    }
  ],
  "confidence": 0.96,
  "risk": { ... },
  "advisory": { ... },
  "follow_up_questions": [
    "What is the agricultural spraying window for the next 48 hours?",
    "Show historical temperature anomaly for this week."
  ],
  "model_version": "weathergpt-v1.0",
  "latency_ms": 12,
  "tool_calls_executed": ["get_current_weather", "get_forecast", "get_alerts", "get_advisory", "get_risk_score"]
}
```

---

### 2. Multi-Hazard Risk Scoring
`POST /api/v1/risk/score`

**Request:**
```json
{
  "hazard": "heavy_rain",
  "location": {"name": "Lucknow"},
  "weather_context": {
    "rainfall_rate": 20.0,
    "precipitation_probability": 90,
    "wind_gust": 45.0
  }
}
```

**Response:**
```json
{
  "hazard": "heavy_rain",
  "score": 65,
  "level": "HIGH",
  "confidence": 0.92,
  "model_version": "rule-v1",
  "factors": [
    {
      "feature": "precipitation_probability",
      "impact": "high",
      "observed_value": 90.0,
      "threshold": "Standard meteorological threshold"
    }
  ],
  "official_warning": true,
  "explanation": "HIGH Heavy Rain Risk (Score 65/100) driven primarily by precipitation probability (90.0)."
}
```

---

### 3. Domain Advisory Generation
`POST /api/v1/advisory`

**Request:**
```json
{
  "domain": "agriculture",
  "location": {"name": "Lucknow"},
  "weather_context": {
    "rainfall_rate": 14.0,
    "precipitation_probability": 85,
    "temperature": 32.0
  }
}
```

**Response:**
```json
{
  "domain": "agriculture",
  "severity": "HIGH",
  "title": "Agricultural Operations & Crop Weather Advisory",
  "summary": "Advisory for farming operations: Rain probability 85.0%, Temperature 32.0°C. Suspension of spraying and field drainage advised.",
  "recommendations": [
    {
      "action": "Postpone chemical and pesticide spraying operations.",
      "urgency": "immediate",
      "priority": 1,
      "reason": "High precipitation risk (85.0% PoP) will cause chemical wash-off."
    }
  ],
  "valid_until": "2026-09-12T14:00:00Z"
}
```

---

### 4. Anomaly Detection
`POST /api/v1/anomaly/detect`

**Request:**
```json
{
  "location": {"name": "Lucknow"},
  "metric": "temperature",
  "observed_values": {"temperature": 36.5},
  "month": 9
}
```

**Response:**
```json
{
  "location_name": "Lucknow",
  "month_analyzed": "September",
  "baseline_period": "1991-2020 IMD 30-Year Climatological Normals",
  "anomalies_detected": 1,
  "results": [
    {
      "metric": "temperature",
      "observed_value": 36.5,
      "baseline_mean": 28.0,
      "z_score": 4.25,
      "percentile": 99.9,
      "is_anomaly": true,
      "severity": "EXTREME",
      "anomaly_direction": "above_normal"
    }
  ],
  "interpretation": "Observed weather in Lucknow for September: Temperature is +8.5°C vs normal (Z-Score: 4.25, EXTREME departure)."
}
```

---

### 5. Decadal Climate Trend Analytics
`POST /api/v1/climate/analyze`

**Request:**
```json
{
  "location": {"name": "Lucknow"},
  "metric": "temperature",
  "period_years": 30
}
```

---

## 🧪 Testing & Verification

### Run the Pytest Test Suite:
```powershell
python -m pytest -v app/tests
```
**Coverage Highlights:**
- Schema validation & serialization
- Gemini adapter key rotation, cooldown, and mock fallback
- Multilingual intent classification and entity parsing
- Deterministic risk engine boundary cases and factor contributions
- Statistical Z-score and percentile anomaly detection
- Agricultural, travel, disaster, and urban advisory rules
- Grounding integrity & anti-hallucination verification
- End-to-end FastAPI endpoint integration tests

### Run SIH Demo Scenarios:
```powershell
python scripts/test_chat_demo.py
```

### Run Performance & Latency Benchmark:
```powershell
python scripts/benchmark_latency.py
```

---

## 🐳 Docker Deployment

Build and run containerized service:
```powershell
# Build image
docker build -t weathergpt-ai:latest .

# Run container
docker run -d -p 8000:8000 --env-file .env --name weathergpt-ai-service weathergpt-ai:latest
```

---

## 📋 SIH PS 26068 Compliance Checklist

- [x] Independent Python/FastAPI microservice behind backend trust boundary.
- [x] Multi-key Gemini adapter with automatic rotation, rate-limit cooldown, and fallback.
- [x] Transparent, deterministic risk scoring engine (`rule-v1`) with factor explainability.
- [x] Separation of official IMD warnings from AI-generated risk interpretation.
- [x] Domain-specific advisory engine for Agriculture, Travel, Disaster, and Urban scenarios.
- [x] Statistical anomaly engine comparing against 30-year IMD climatological normals.
- [x] Decadal climate trend analysis with scientific causality caveats.
- [x] Multilingual English and Hindi generation with number and unit preservation.
- [x] Mock mode (`MOCK_MODE=true`) for offline demonstration and testing.
- [x] Comprehensive automated test suite and latency benchmarking suite.
