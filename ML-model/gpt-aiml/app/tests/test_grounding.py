"""Unit tests for anti-hallucination grounding and missing data handling."""
import pytest
from app.agent.orchestrator import AgentOrchestrator
from app.schemas.chat import ChatRequest
from app.schemas.common import GeoLocation


@pytest.mark.asyncio
async def test_grounded_chat_preserves_verified_facts():
    orchestrator = AgentOrchestrator()
    req = ChatRequest(
        message="What is the current temperature in Lucknow and are there any alerts?",
        location=GeoLocation(name="Lucknow"),
    )
    res = await orchestrator.process_chat(req)

    # Response should have citations and audit trail
    assert len(res.sources) > 0
    assert "get_current_weather" in res.tool_calls_executed
    assert res.confidence > 0.8
    assert "Lucknow" in res.answer


@pytest.mark.asyncio
async def test_grounded_chat_with_backend_context_override():
    orchestrator = AgentOrchestrator()
    custom_temp = 19.8
    req = ChatRequest(
        message="What is the temperature right now?",
        location=GeoLocation(name="Shimla"),
        weather_context={
            "temperature": custom_temp,
            "condition": "Light Mist",
            "humidity": 65,
            "source": "Custom_Trusted_Backend_Sensor",
        }
    )
    res = await orchestrator.process_chat(req)
    assert str(custom_temp) in res.answer
    assert "Shimla" in res.answer
