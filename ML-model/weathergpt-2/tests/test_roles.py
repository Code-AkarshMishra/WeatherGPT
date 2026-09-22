from app.services.followups import suggest_follow_ups
from app.services.roles import normalize_role, role_advisory_domain, UserRole


def test_normalize_ui_role_labels():
    assert normalize_role("Citizen") == UserRole.CITIZEN
    assert normalize_role("Farmer / Crop Advisory") == UserRole.FARMER
    assert normalize_role("Climate Analyst") == UserRole.CLIMATE_ANALYST
    assert normalize_role("Urban Planner") == UserRole.URBAN_PLANNER
    assert normalize_role("Air Quality") == UserRole.AIR_QUALITY
    assert normalize_role("Flood & Disaster") == UserRole.FLOOD_DISASTER
    assert normalize_role("flood_disaster") == UserRole.FLOOD_DISASTER
    assert normalize_role("disaster") == UserRole.FLOOD_DISASTER


def test_farmer_gets_agriculture_domain():
    assert role_advisory_domain(UserRole.FARMER) == "agriculture"
    assert role_advisory_domain(UserRole.AVIATION) == "travel"
    assert role_advisory_domain(UserRole.FLOOD_DISASTER) == "disaster"


def test_role_follow_ups_differ():
    citizen = suggest_follow_ups("forecast", "en", "Lucknow", role="citizen")
    farmer = suggest_follow_ups("forecast", "en", "Lucknow", role="farmer")
    assert citizen != farmer
    assert any("irrigat" in q.lower() or "pesticide" in q.lower() or "crop" in q.lower() for q in farmer)
    assert any("umbrella" in q.lower() or "walk" in q.lower() or "alert" in q.lower() for q in citizen)
