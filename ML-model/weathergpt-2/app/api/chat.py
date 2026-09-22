from fastapi import APIRouter

from app.models.chat import ChatRequest, ChatResponse
from app.services.gemini import chat_with_tools

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    location = None
    if request.location is not None:
        location = {
            "lat": request.location.lat,
            "lon": request.location.lon,
            "name": request.location.name,
        }

    result = chat_with_tools(
        request.message,
        location=location,
        alert_context=request.alert_context,
        role=request.role,
    )
    return ChatResponse(
        response=result["response"],
        language=result["language"],
        status="ok",
        intent=result.get("intent"),
        role=result.get("role"),
        tool_calls=result.get("tool_calls") or [],
        risk=result.get("risk"),
        advisory=result.get("advisory"),
        follow_up_questions=result.get("follow_up_questions") or [],
        confidence=result.get("confidence"),
        latency_ms=result.get("latency_ms"),
        tts_hint=result.get("tts_hint"),
        disaster_assessment=result.get("disaster_assessment"),
        historical_analysis=result.get("historical_analysis"),
    )
