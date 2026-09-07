"""
main.py
Unified WeatherGPT Machine Learning & AI Microservice (ML-1 + ML-2).
Combines:
- ML-1: Conversational LLM Tool-Calling & Open-Meteo Ingest
- ML-2: MoES Severe-Weather Random Forest Predictor & Regional Voice Accessibility
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

try:
    from .models import (
        ChatRequest,
        ChatResponse,
        DisasterRiskRequest,
        DisasterRiskResponse,
        TTSRequest,
        TTSResponse
    )
    from .gemini_agent import answer_query
    from .disaster_predictor import disaster_predictor
    from .tts_service import generate_alert_audio
except ImportError:
    from models import (
        ChatRequest,
        ChatResponse,
        DisasterRiskRequest,
        DisasterRiskResponse,
        TTSRequest,
        TTSResponse
    )
    from gemini_agent import answer_query
    from disaster_predictor import disaster_predictor
    from tts_service import generate_alert_audio

app = FastAPI(
    title="WeatherGPT Unified ML Service",
    description="Unified AI & MoES Disaster Intelligence Service for WeatherGPT",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "service": "WeatherGPT Unified ML Service",
        "version": "2.0.0",
        "status": "online",
        "modules": {
            "ml1_llm_tool_calling": "active",
            "ml2_moes_disaster_predictor": "active",
            "ml2_regional_voice_tts": "active"
        }
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "weathergpt-unified-ml",
        "version": "2.0.0"
    }

@app.get("/system-status")
def system_status():
    try:
        from .gemini_agent import get_system_key_status
    except ImportError:
        from gemini_agent import get_system_key_status
    return {
        "status": "online",
        "service": "weathergpt-unified-ml",
        "ai_keys": get_system_key_status()
    }

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest) -> ChatResponse:
    from fastapi import HTTPException
    lat = request.location.lat if request.location else None
    lon = request.location.lon if request.location else None
    role = request.role or "citizen"

    reply, lang, risk = answer_query(request.message, lat=lat, lon=lon, role=role)

    if reply is None:
        # Intentionally deferred to Node.js Gemini pipeline — signal 422 so Node falls back
        raise HTTPException(status_code=422, detail="Deferred to primary Gemini pipeline")

    return ChatResponse(
        response=reply,
        language=lang,
        provider="ml-unified-gemini",
        status="ok",
        disaster_risk=risk
    )

@app.post("/disaster-risk", response_model=DisasterRiskResponse)
@app.get("/disaster-risk", response_model=DisasterRiskResponse)
def disaster_risk_endpoint(
    rain_mm: float = 0.0,
    wind_kmph: float = 0.0,
    temp_c: float = 25.0,
    city: str = "Your Area"
) -> DisasterRiskResponse:
    result = disaster_predictor.predict(rain_mm, wind_kmph, temp_c, city=city)
    return DisasterRiskResponse(**result)

@app.post("/tts", response_model=TTSResponse)
def tts_endpoint(req: TTSRequest) -> TTSResponse:
    audio_path = generate_alert_audio(req.text, city="alert")
    if audio_path:
        return TTSResponse(status="ok", audio_file=audio_path, message="Audio generated successfully")
    return TTSResponse(status="fallback", audio_file=None, message="Edge-TTS fallback to Web Speech")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ml-service.main:app", host="0.0.0.0", port=8000, reload=True)
