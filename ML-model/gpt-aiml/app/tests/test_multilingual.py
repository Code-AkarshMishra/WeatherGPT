"""Unit tests for Multilingual English and Hindi weather intelligence."""
import pytest
from app.agent.orchestrator import AgentOrchestrator
from app.schemas.chat import ChatRequest
from app.schemas.common import GeoLocation


@pytest.mark.asyncio
async def test_hindi_query_returns_hindi_grounded_answer():
    orchestrator = AgentOrchestrator()
    req = ChatRequest(
        message="लखनऊ में मौसम कैसा है और क्या बारिश होगी?",
        location=GeoLocation(name="Lucknow"),
        language="hi",
    )
    res = await orchestrator.process_chat(req)

    assert res.language == "hi"
    # Hindi response contains Lucknow in Hindi or English and weather phrasing
    assert ("लखनऊ" in res.answer or "Lucknow" in res.answer)
    assert any('\u0900' <= c <= '\u097F' for c in res.answer)
    assert res.confidence > 0.8
