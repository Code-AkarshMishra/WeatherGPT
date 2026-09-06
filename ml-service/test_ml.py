"""
test_ml.py
Unit tests for the consolidated ML service.
"""

from disaster_predictor import disaster_predictor
from weather_service import get_current_weather
from gemini_agent import detect_language, answer_query

def test_disaster_predictor():
    print("Testing MoES Disaster Predictor (ML-2)...")
    green = disaster_predictor.predict(0, 10, 26, "Lucknow")
    assert green["imd_color_code"] == "GREEN"
    assert "farmer_advisory" in green
    assert "marine_advisory" in green
    print("[PASS] GREEN test passed:", green["risk_assessment"])

    orange = disaster_predictor.predict(70, 50, 22, "Varanasi")
    assert orange["imd_color_code"] == "ORANGE"
    print("[PASS] ORANGE test passed:", orange["risk_assessment"])

    red = disaster_predictor.predict(130, 85, 20, "Puri")
    assert red["imd_color_code"] == "RED"
    print("[PASS] RED test passed:", red["risk_assessment"])

def test_language_detection():
    print("\nTesting Language Detection...")
    assert detect_language("What is the weather today?") == "en"
    assert detect_language("मौसम कैसा है?") == "hi"
    assert detect_language("kya aaj baarish hogi?") == "hinglish"
    print("[PASS] Language detection tests passed")

def test_query_answering():
    print("\nTesting Query Answering (ML-1 + ML-2)...")
    reply, lang, risk = answer_query("Kya fasal ko paani du?", lat=26.8467, lon=80.9462, role="farmer")
    assert len(reply) > 20
    assert risk["imd_color_code"] in ["GREEN", "YELLOW", "ORANGE", "RED"]
    print("[PASS] Answer query passed!")

if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING UNIFIED WEATHERGPT ML SERVICE AUDIT & TESTS")
    print("=" * 60)
    test_disaster_predictor()
    test_language_detection()
    test_query_answering()
    print("\n" + "=" * 60)
    print("ALL ML-1 AND ML-2 TESTS PASSED SUCCESSFULLY! [OK]")
    print("=" * 60)
