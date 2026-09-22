"""Flood & Disaster role — interprets existing NWP hazards without re-fetching models."""
from unittest.mock import patch

from app.services.flood_disaster import (
    build_disaster_assessment,
    format_disaster_context_block,
    normalize_official_warnings,
)
from app.services.intent import classify_intent
from app.services.nwp import parse_nwp_hourly
from app.services.nwp_hazards import (
    analyze_nwp_hazards,
    classify_cyclone_related_severity,
    classify_heat_severity,
)
from app.services.request_parser import parse_user_request
from app.services.roles import UserRole, normalize_role


def _hourly(
    precip,
    wind=None,
    gust=None,
    cape=None,
    temp=None,
    pressure=None,
    model="gfs",
):
    n = len(precip)
    wind = wind or [10] * n
    gust = gust or [12] * n
    cape = cape or [200] * n
    temp = temp or [30] * n
    pressure = pressure or [1012] * n
    times = [f"2026-09-16T{i:02d}:00" for i in range(n)]
    hourly = {
        "time": times,
        "precipitation": precip,
        "rain": precip,
        "wind_speed_10m": wind,
        "wind_gusts_10m": gust,
        "wind_direction_10m": [90] * n,
        "temperature_2m": temp,
        "pressure_msl": pressure,
        "cloud_cover": [70] * n,
        "cape": cape,
    }
    if model == "gfs":
        hourly["precipitation_probability"] = [80] * n
        hourly["relative_humidity_2m"] = [75] * n
    parsed = parse_nwp_hourly(
        {"latitude": 26.85, "longitude": 80.95, "timezone": "Asia/Kolkata", "hourly": hourly},
        model,
    )
    return parsed["hourly"]


def _bundle(gfs_hourly, ecm_hourly, available=("GFS", "ECMWF")):
    models = {}
    if gfs_hourly is not None:
        models["gfs"] = {"available": True, "hourly": gfs_hourly}
    else:
        models["gfs"] = {"available": False, "hourly": []}
    if ecm_hourly is not None:
        models["ecmwf"] = {"available": True, "hourly": ecm_hourly}
    else:
        models["ecmwf"] = {"available": False, "hourly": []}
    return {
        "forecast_hours": 48,
        "available_models": list(available),
        "models": models,
    }


def _nwp(gfs, ecm, available=("GFS", "ECMWF"), location="Lucknow"):
    assessment = analyze_nwp_hazards(_bundle(gfs, ecm, available))
    assessment["available"] = True
    assessment["location"] = {"name": location, "latitude": 26.85, "longitude": 80.95}
    return assessment


def test_no_hazard():
    gfs = _hourly([0.0] * 24)
    ecm = _hourly([0.0] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    assert nwp["overall_risk"] == "normal"
    assert nwp["hazards"] == []
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert disaster["available"] is True
    assert disaster["overall_risk"] == "normal"
    assert disaster["developing_hazards"] == []
    assert "not currently flag" in disaster["situation"].lower() or "normal" in disaster["situation"].lower()
    assert disaster["official_warning"] is False
    assert disaster["official_warning_status"]["present"] is False


def test_extreme_rainfall():
    gfs = _hourly([5.0] * 24)
    ecm = _hourly([4.5] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    rain = next(h for h in nwp["hazards"] if h["type"] == "heavy_rain")
    assert rain["severity"] in {"moderate", "high"}
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert any(h["type"] == "heavy_rain" for h in disaster["developing_hazards"])
    assert disaster["rainfall_concern"] is not None
    assert "waterlogging" in disaster["rainfall_concern"].lower()
    assert "not a flood prediction" in disaster["rainfall_concern"].lower()
    assert "120" in disaster["rainfall_concern"]


def test_strong_wind():
    gfs = _hourly([0.0] * 24, wind=[45] * 24, gust=[60] * 24)
    ecm = _hourly([0.0] * 24, wind=[42] * 24, gust=[58] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    wind = next(h for h in nwp["hazards"] if h["type"] == "strong_wind")
    assert wind["severity"] in {"moderate", "high"}
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert any(h["type"] == "strong_wind" for h in disaster["developing_hazards"])
    assert "evacuat" not in disaster["advisory"].lower()


def test_thunderstorm_conditions():
    gfs = _hourly([2.0] * 24, gust=[60] * 24, cape=[2500] * 24)
    ecm = _hourly([1.5] * 24, gust=[58] * 24, cape=[2200] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    conv = next(h for h in nwp["hazards"] if h["type"] == "convective")
    assert conv["severity"] in {"watch", "moderate", "high"}
    note = (conv.get("note") or "").lower()
    assert "cape alone does not mean" in note
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    conv_fact = next(h for h in disaster["developing_hazards"] if h["type"] == "convective")
    assert conv_fact["max_cape_jkg"]["gfs"] == 2500.0


def test_extreme_heat():
    assert classify_heat_severity({"max_temperature_c": 36}) == "none"
    assert classify_heat_severity({"max_temperature_c": 38.5}) == "watch"
    assert classify_heat_severity({"max_temperature_c": 40.5}) == "moderate"
    assert classify_heat_severity({"max_temperature_c": 43}) == "high"
    gfs = _hourly([0.0] * 24, temp=[41] * 24)
    ecm = _hourly([0.0] * 24, temp=[40.5] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    heat = next(h for h in nwp["hazards"] if h["type"] == "extreme_heat")
    assert heat["severity"] in {"moderate", "high"}
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert any(h["type"] == "extreme_heat" for h in disaster["developing_hazards"])
    # Without coordinates, ERA5 baseline is unavailable (no mock station fallback).
    assert disaster["historical_baseline"]["available"] is False
    assert disaster["heat_vs_baseline"] is None
    assert "heatwave warning" in disaster["advisory"].lower() or "not an official" in disaster["advisory"].lower()


@patch("app.services.historical_analysis.nwp_vs_archive_context")
def test_extreme_heat_with_live_era5_baseline(mock_hist):
    mock_hist.return_value = {
        "available": True,
        "source": "open_meteo_historical_archive",
        "same_month_metrics": {"average_temperature_c": 30.0},
        "nwp_vs_rainfall_baseline": None,
        "nwp_vs_temperature_baseline": {
            "nwp_max_c": 41.0,
            "historical_mean_c": 30.0,
            "difference_c": 11.0,
        },
    }
    gfs = _hourly([0.0] * 24, temp=[41] * 24)
    ecm = _hourly([0.0] * 24, temp=[40.5] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    disaster = build_disaster_assessment(
        nwp, location_name="Lucknow", latitude=26.85, longitude=80.95
    )
    assert disaster["historical_baseline"]["available"] is True
    assert disaster["heat_vs_baseline"] is not None
    assert "30.0" in disaster["heat_vs_baseline"] or "baseline" in disaster["heat_vs_baseline"].lower()


def test_cyclone_related_conditions():
    assert (
        classify_cyclone_related_severity(
            {"min_pressure_hpa": 1012, "pressure_drop_hpa": 0}, "none", "none"
        )
        == "none"
    )
    precip = [4.0] * 24
    wind = [70] * 24
    gust = [90] * 24
    pressure = [1008 - i * 0.5 for i in range(24)]  # drops ~12 hPa
    gfs = _hourly(precip, wind=wind, gust=gust, pressure=pressure)
    ecm = _hourly(precip, wind=[65] * 24, gust=[85] * 24, pressure=pressure, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    cyc = next(h for h in nwp["hazards"] if h["type"] == "cyclone_related")
    assert cyc["severity"] in {"moderate", "high"}
    assert "does not mean a cyclone exists" in (cyc.get("note") or "").lower()
    disaster = build_disaster_assessment(nwp, location_name="Mumbai")
    assert any(h["type"] == "cyclone_related" for h in disaster["developing_hazards"])
    assert "landfall" not in disaster["advisory"].lower() or "does not" in disaster["advisory"].lower()
    assert disaster["official_warning"] is False


def test_multiple_simultaneous_hazards():
    gfs = _hourly(
        [5.0] * 24,
        wind=[45] * 24,
        gust=[60] * 24,
        cape=[2500] * 24,
        temp=[41] * 24,
    )
    ecm = _hourly(
        [4.6] * 24,
        wind=[44] * 24,
        gust=[58] * 24,
        cape=[2300] * 24,
        temp=[40.5] * 24,
        model="ecmwf",
    )
    nwp = _nwp(gfs, ecm)
    types = {h["type"] for h in nwp["hazards"]}
    assert "heavy_rain" in types
    assert "strong_wind" in types
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert len(disaster["developing_hazards"]) >= 2
    assert "multiple hazardous weather conditions" in disaster["situation"].lower()
    assert "multiple hazardous weather conditions" in disaster["advisory"].lower()


def test_gfs_ecmwf_agreement():
    gfs = _hourly([5.0] * 24)
    ecm = _hourly([4.6] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    rain = next(h for h in nwp["hazards"] if h["type"] == "heavy_rain")
    assert rain["model_agreement"] == "high"
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert disaster["model_agreement"] == "high"
    assert "not a probability" in disaster["model_agreement_text"].lower()
    assert "87%" not in disaster["model_agreement_text"]


def test_gfs_ecmwf_disagreement():
    gfs = _hourly([5.0] * 24)
    ecm = _hourly([0.4] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    rain = next((h for h in nwp["hazards"] if h["type"] == "heavy_rain"), None)
    assert rain is not None
    assert rain["model_agreement"] == "low"
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert "significant differences" in disaster["model_agreement_text"].lower()
    assert "87%" not in disaster["model_agreement_text"]


def test_missing_gfs_data():
    ecm = _hourly([5.0] * 24, model="ecmwf")
    nwp = _nwp(None, ecm, available=("ECMWF",))
    rain = next(h for h in nwp["hazards"] if h["type"] == "heavy_rain")
    assert rain["model_agreement"] == "single_model"
    assert rain["gfs_value"] is None
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert disaster["model_agreement"] == "single_model"
    assert "only one nwp model" in disaster["model_agreement_text"].lower()


def test_missing_ecmwf_data():
    gfs = _hourly([5.0] * 24)
    nwp = _nwp(gfs, None, available=("GFS",))
    rain = next(h for h in nwp["hazards"] if h["type"] == "heavy_rain")
    assert rain["ecmwf_value"] is None
    disaster = build_disaster_assessment(nwp, location_name="Lucknow")
    assert disaster["available_models"] == ["GFS"]


def test_missing_historical_baseline():
    gfs = _hourly([0.0] * 24, temp=[41] * 24)
    ecm = _hourly([0.0] * 24, temp=[41] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm, location="Unknownville")
    disaster = build_disaster_assessment(nwp, location_name="Unknownville")
    assert disaster["historical_baseline"]["available"] is False
    assert disaster["heat_vs_baseline"] is None


def test_existing_official_warning():
    gfs = _hourly([5.0] * 24)
    ecm = _hourly([4.5] * 24, model="ecmwf")
    nwp = _nwp(gfs, ecm)
    official = [
        {
            "headline": "Orange warning issued for heavy rainfall.",
            "severity": "ORANGE",
            "hazard": "heavy_rain",
            "issued_by": "IMD",
        }
    ]
    disaster = build_disaster_assessment(
        nwp, official_warnings=official, location_name="Lucknow"
    )
    assert disaster["official_warning"] is False
    assert disaster["official_warning_status"]["present"] is True
    assert "Orange warning" in disaster["official_warning_status"]["warnings"][0]["headline"]
    block = format_disaster_context_block(disaster)
    assert "Orange warning issued for heavy rainfall." in block
    assert '"official_warning": false' in block.lower() or '"official_warning": False' in block


def test_no_official_warning():
    status = normalize_official_warnings(None)
    assert status["present"] is False
    assert "no official warning" in status["status_text"].lower()
    gfs = _hourly([0.0] * 24)
    ecm = _hourly([0.0] * 24, model="ecmwf")
    disaster = build_disaster_assessment(_nwp(gfs, ecm), official_warnings=[], location_name="Lucknow")
    assert disaster["official_warning_status"]["present"] is False


def test_missing_location_asks_not_guess():
    parsed = parse_user_request(
        "What disaster risks are developing?",
        role="flood_disaster",
    )
    assert parsed["role"] == "flood_disaster"
    assert parsed["location"] is None
    disaster = build_disaster_assessment(
        {"available": False, "error": "Location not resolved. Do not guess NWP values."}
    )
    assert disaster["available"] is False
    assert "do not guess" in disaster["error"].lower()


def test_invalid_location_no_baseline_fabricated():
    disaster = build_disaster_assessment(
        {"available": False, "error": "Location not resolved."},
        location_name="NotARealCityXYZ",
    )
    assert disaster["available"] is False


def test_llm_block_preserves_nwp_numbers():
    gfs = _hourly([5.0] * 24)
    ecm = _hourly([4.0] * 24, model="ecmwf")
    disaster = build_disaster_assessment(_nwp(gfs, ecm), location_name="Lucknow")
    block = format_disaster_context_block(disaster)
    assert "120.0" in block or "120" in block
    assert "96.0" in block or "96" in block
    assert "Do NOT invent" in block
    assert "999 mm" not in block


def test_llm_must_not_invent_official_warnings():
    gfs = _hourly([5.0] * 24)
    ecm = _hourly([4.5] * 24, model="ecmwf")
    disaster = build_disaster_assessment(_nwp(gfs, ecm), official_warnings=[], location_name="Lucknow")
    block = format_disaster_context_block(disaster)
    assert '"present": false' in block
    assert "Never invent an official warning" in block or "Do NOT invent" in block
    assert "A flood will occur" in str(disaster["forbidden_claims"])


def test_flood_role_activates_from_disaster_queries():
    assert classify_intent("Are there any disaster risks developing in Mumbai?") == "disaster_risk"
    assert classify_intent("What hazards are expected in my area tomorrow?") == "disaster_risk"
    assert classify_intent("Is there any severe weather I should be worried about?") == "disaster_risk"
    assert classify_intent("What should disaster management authorities watch for?") == "disaster_risk"
    parsed = parse_user_request(
        "Are there any disaster risks developing in Mumbai?",
        role="citizen",
    )
    assert parsed["intent"] == "disaster_risk"
    fd = parse_user_request(
        "What disaster-related hazards are developing in Lucknow?",
        role="flood_disaster",
    )
    assert fd["role"] == "flood_disaster"
    assert fd["intent"] == "disaster_risk"
    assert fd["location"] == "Lucknow"
    assert normalize_role("Flood & Disaster") == UserRole.FLOOD_DISASTER


def test_existing_farmer_citizen_researcher_roles_continue():
    farmer = parse_user_request(
        "I'm a farmer in Lucknow. Heavy rain is expected tomorrow. Should I harvest wheat?",
        role="farmer",
    )
    assert farmer["role"] == "farmer"
    assert farmer["intent"] == "harvest_decision"
    citizen = parse_user_request("What is the weather in Pune?", role="citizen")
    assert citizen["role"] == "citizen"
    researcher = parse_user_request(
        "Show the daily rain totals for Lucknow over the next 7 days.",
        role="researcher",
    )
    assert researcher["role"] == "researcher"


def test_disaster_unavailable_forbids_invention():
    block = format_disaster_context_block(
        {
            "available": False,
            "error": "Both GFS and ECMWF NWP requests failed. No hazard claim can be made.",
        }
    )
    assert "UNAVAILABLE" in block
    assert "Do NOT invent" in block


@patch("app.services.nwp.get_nwp_forecasts")
def test_flood_disaster_does_not_refetch_inside_role_layer(mock_fetch):
    """The role layer consumes a structured NWP result; it must not call GFS/ECMWF."""
    gfs = _hourly([5.0] * 24)
    ecm = _hourly([4.5] * 24, model="ecmwf")
    build_disaster_assessment(_nwp(gfs, ecm), location_name="Lucknow")
    mock_fetch.assert_not_called()
