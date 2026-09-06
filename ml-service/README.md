# WeatherGPT Unified Machine Learning & AI Service (ML-1 + ML-2)

This directory consolidates, audits, and unifies the two machine learning sub-projects:
- **ML-1 (`weathergpt`)**: Conversational Natural Language + LLM Tool-Calling agent with Open-Meteo live weather data.
- **ML-2 (`MoES-Disaster-Predictor`)**: Random Forest classifier predicting IMD color-coded alerts (`GREEN`, `YELLOW`, `ORANGE`, `RED`), severe-weather risk assessments, specialized **Farmer** & **Marine** advisories, and neural speech synthesis.

---

## 📁 Unified Architecture

```
a:\WeatherGPT\ml-service\
├── main.py                 # Unified FastAPI application entry point
├── disaster_predictor.py   # MoES Random Forest IMD Warning Predictor (ML-2)
├── gemini_agent.py         # Natural Language & LLM Tool Calling Engine (ML-1 + ML-2)
├── weather_service.py      # Open-Meteo live weather & geocoding client (ML-1)
├── tts_service.py          # Edge-TTS Neural Voice Synthesizer (ML-2)
├── models.py               # Pydantic schemas for request / response validation
├── test_ml.py              # Automated test suite (all tests passing)
├── requirements.txt        # Python dependency manifest
└── README.md               # Architecture, audit, and API reference
```

---

## 🔍 Audit & Enhancements

| Component | Original State (ML-1 / ML-2) | Unified State (`ml-service`) |
| :--- | :--- | :--- |
| **Microservice Framework** | ML-1 had FastAPI; ML-2 was a bare CLI script (`moes_features.py`). | Unified under high-performance FastAPI with automatic OpenAPI docs (`/docs`). |
| **Role Personas** | ML-1 only answered simple citizen weather questions. | Grounded role personas for **Farmer**, **Marine**, **Disaster**, and **Citizen**. |
| **IMD Color Coded Alerts** | ML-2 classified into 4 tiers with hardcoded strings. | Enhanced with extreme threshold guards (rainfall >115mm, wind >75km/h, temperature >44°C). |
| **Marine Advisory** | Mentioned in problem statement but missing in ML-2 code. | Explicitly added bilingual Marine advisories (sea state, chop, small-craft warnings). |
| **Voice Accessibility** | ML-2 saved local MP3 files via `asyncio.run()`. | Edge-TTS service with fallback to Web Speech API. |
| **Backend / Frontend Integration** | Separate repos. | Node Express backend and React frontend are directly bridged to this service. |

---

## 🚀 API Endpoints

### 1. Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "service": "weathergpt-unified-ml",
  "version": "2.0.0"
}
```

### 2. Conversational AI with LLM Tool Calling
```http
POST /chat
Content-Type: application/json

{
  "message": "Kya aaj khet me sinchai karni chahiye?",
  "location": { "lat": 26.8467, "lon": 80.9462 },
  "role": "farmer"
}
```

### 3. MoES Severe-Weather Risk & IMD Warning
```http
POST /disaster-risk
Content-Type: application/json

{
  "rain_mm": 75.0,
  "wind_kmph": 50.0,
  "temp_c": 24.0,
  "city": "Lucknow"
}
```
**Response:**
```json
{
  "city": "Lucknow",
  "rain_mm": 75.0,
  "wind_kmph": 50.0,
  "temp_c": 24.0,
  "imd_color_code": "ORANGE",
  "risk_assessment": "High",
  "status_text": "Alert / Be Prepared",
  "farmer_advisory": {
    "hi": "भारी बारिश और 45+ किमी/घंटा तेज हवा की चेतावनी! कीटनाशक छिड़काव और सिंचाई तुरंत रोकें...",
    "en": "Heavy rainfall and 45+ km/h squall alert! Suspend pesticide spraying..."
  },
  "marine_advisory": {
    "hi": "समुद्र अशांत (45-65 किमी/घंटा तेज हवा)...",
    "en": "Rough sea conditions with squalls up to 65 km/h..."
  }
}
```

---

## 🧪 Running the Tests
```bash
cd a:\WeatherGPT\ml-service
python test_ml.py
```
