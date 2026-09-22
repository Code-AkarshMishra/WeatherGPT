from app.services.indicators import compute_indicators
from app.services.request_parser import parse_user_request
from app.services.role_advisory import build_advisory
from app.services.role_config import ROLE_CONFIG, get_role_config
from app.services.role_pipeline import format_advisory_context_block
from app.services.weather_bundle import required_variables


def test_all_roles_configured():
    expected = {
        "citizen",
        "farmer",
        "researcher",
        "aviation",
        "marine",
        "climate_analyst",
        "urban_planner",
        "air_quality",
        "flood_disaster",
    }
    assert set(ROLE_CONFIG) == expected
    for key, cfg in ROLE_CONFIG.items():
        assert cfg["variables"]
        assert cfg["priorities"]
        assert get_role_config(key)["label"]


def test_parse_farmer_harvest_lucknow():
    parsed = parse_user_request(
        "I'm a farmer in Lucknow. Heavy rain is expected tomorrow. Should I harvest?",
        role="farmer",
    )
    assert parsed["role"] == "farmer"
    assert parsed["intent"] == "harvest_decision"
    assert parsed["location"] == "Lucknow"
    assert parsed["time_range"] == "tomorrow"
    assert parsed["activity"] == "harvesting"
    assert parsed["urgency"] == "high"
    assert "crop_type" in parsed["missing_information"]


def test_parse_crop_entity_not_missing():
    parsed = parse_user_request(
        "Should I harvest wheat tomorrow in Lucknow? The crop is mature.",
        role="farmer",
    )
    assert parsed["entities"].get("crop_type") == "wheat"
    assert parsed["entities"].get("crop_stage") == "mature"
    assert "crop_type" not in parsed["missing_information"]


def test_farmer_variables_include_wind_not_aqi():
    flags = required_variables("farmer", "harvesting")
    assert flags["precipitation"] is True
    assert flags["wind_gusts"] is True
    assert "aqi" not in flags
    citizen = required_variables("citizen")
    assert citizen["temperature"] is True
    assert "soil_moisture" not in citizen


def test_indicators_from_fake_bundle():
    bundle = {
        "current": {
            "temperature_c": 33,
            "humidity_percent": 80,
            "wind_speed_kmh": 24,
            "wind_gust_kmh": 38,
            "thunderstorm": True,
            "precipitation_mm": 2,
        },
        "forecast": {
            "hourly": [],
            "daily": [
                {
                    "date": "2026-09-16",
                    "precipitation_mm": 5.2,
                    "precipitation_probability_max": 72,
                    "wind_speed_max_kmh": 24,
                    "wind_gust_max_kmh": 38,
                    "temp_max_c": 34,
                    "temp_min_c": 25,
                    "thunderstorm": True,
                    "precipitation_hours": 4,
                    "et0_mm": 4,
                }
            ],
        },
        "extras": {},
    }
    parsed = {
        "role": "farmer",
        "time_range": "tomorrow",
        "activity": "harvesting",
        "missing_information": ["crop_type"],
    }
    derived = compute_indicators("farmer", bundle, parsed)
    assert derived["harvest_risk"] in {"moderate", "high"}
    assert derived["lodging_risk"] in {"moderate", "high"}
    advisory = build_advisory(parsed, bundle, derived)
    assert advisory["confidence"] in {"low", "medium", "high"}
    assert "crop_type" in advisory["missing_information"]
    assert "harvest" in advisory["recommendation"].lower()


def test_unavailable_block_forbids_invention():
    text = format_advisory_context_block(
        {"available": False, "error": "Weather service unavailable"}
    )
    assert "WEATHER DATA UNAVAILABLE" in text
    assert "Do NOT invent" in text
