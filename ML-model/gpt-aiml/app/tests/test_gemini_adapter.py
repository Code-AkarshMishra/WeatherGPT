"""Unit tests for Gemini adapter and key rotation manager."""
import pytest
from app.llm.gemini import GeminiAdapter
from app.llm.key_manager import GeminiKeyManager


def test_key_manager_rotation_and_cooldown():
    keys = ["key_alpha_123456789012345678901234", "key_beta_1234567890123456789012345"]
    mgr = GeminiKeyManager(keys=keys, cooldown_seconds=60)

    # First call gets key 1
    k1 = mgr.get_active_key()
    assert k1 == keys[0]

    # Second call gets key 2
    k2 = mgr.get_active_key()
    assert k2 == keys[1]

    # Rate limit key 1
    mgr.record_rate_limit(keys[0], custom_cooldown=100)

    # Now get_active_key should return key 2
    k3 = mgr.get_active_key()
    assert k3 == keys[1]

    # Verify status report
    status = mgr.get_status_report()
    assert len(status) == 2
    assert status[0]["masked_key"].startswith("key_***")


@pytest.mark.asyncio
async def test_mock_grounded_response_generation():
    adapter = GeminiAdapter(key_manager=GeminiKeyManager(keys=[]))
    res = await adapter.generate_grounded_response(
        system_prompt="Test Prompt",
        user_prompt="What is the weather in Lucknow?",
        context_data={
            "location": {"name": "Lucknow"},
            "current_weather": {"temperature": 32.0, "condition": "Cloudy", "humidity": 75},
            "alerts": [],
        },
        language="en"
    )

    assert "Lucknow" in res.answer
    assert "32.0" in res.answer or "32" in res.answer
    assert res.confidence > 0.8
    assert len(res.follow_up_questions) > 0
