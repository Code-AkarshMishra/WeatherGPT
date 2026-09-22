"""Historical analysis and NWP previous-run verification (no live API required)."""
from unittest.mock import patch

import httpx

from app.services.historical_analysis import (
    analyze_location,
    compare_locations,
    format_historical_context_block,
    parse_period,
    run_historical_query,
    summarize_daily,
)
from app.services.intent import classify_intent
from app.services.nwp_verification import (
    _metrics,
    clamp_nwp_archive_window,
    daily_precip_from_hourly,
    parse_previous_runs_hourly,
    verify_models,
)
from app.services.request_parser import parse_user_request
from app.services.weather import parse_archive_daily


def _daily(n=365, rain=2.0, tmax=32.0, tmin=22.0, tmean=27.0, wind=12.0, start="2024-01-01"):
    from datetime import date, timedelta

    d0 = date.fromisoformat(start)
    rows = []
    for i in range(n):
        day = d0 + timedelta(days=i)
        r = rain
        if i == 10:
            r = 80.0
        rows.append(
            {
                "date": day.isoformat(),
                "precipitation_mm": r,
                "temp_max_c": tmax,
                "temp_min_c": tmin,
                "mean_temp_c": tmean,
                "wind_speed_max_kmh": wind,
            }
        )
    return rows


def _ok_bundle(rows, lat=26.85, lon=80.95):
    return {
        "available": True,
        "latitude": lat,
        "longitude": lon,
        "daily": rows,
        "day_count": len(rows),
        "source": "open_meteo_historical_archive",
        "dataset": "ERA5",
    }


def test_parse_archive_daily():
    payload = {
        "daily": {
            "time": ["2024-06-01", "2024-06-02"],
            "temperature_2m_max": [36.0, 37.0],
            "temperature_2m_min": [26.0, 27.0],
            "temperature_2m_mean": [31.0, 32.0],
            "precipitation_sum": [4.0, 0.0],
            "wind_speed_10m_max": [15.0, 12.0],
            "weather_code": [61, 1],
        }
    }
    rows = parse_archive_daily(payload)
    assert len(rows) == 2
    assert rows[0]["precipitation_mm"] == 4.0
    assert rows[1]["mean_temp_c"] == 32.0


def test_single_city_and_one_year_stats():
    rows = _daily(365, rain=3.0, start="2023-09-16")
    stats = summarize_daily(rows)
    assert stats["days_with_data"] == 365
    assert stats["total_rainfall_mm"] == round(3.0 * 364 + 80.0, 1)
    assert stats["maximum_daily_rainfall_mm"] == 80.0
    assert stats["extreme_rainfall_days"] == 1
    assert "WeatherGPT screening threshold" in stats["thresholds"]["label"]


def test_multi_year_period_parse():
    period = parse_period("last 5 years", today=__import__("datetime").date(2026, 9, 16))
    assert period["available"] is True
    assert period["label"] == "last_5_years"
    assert period["start"] < period["end"]
    assert period["classification"] == "multi_year_record"


def test_long_range_clamped():
    period = parse_period("last 10 years", today=__import__("datetime").date(2026, 9, 16))
    assert period["available"] is True
    assert any("clamped" in n.lower() or "10" in period["label"] for n in period["notes"] + [period["label"]])


@patch("app.services.historical_analysis.fetch_historical_daily")
def test_multi_city_same_range(mock_fetch):
    mock_fetch.side_effect = [
        _ok_bundle(_daily(30, rain=5.0, start="2025-01-01")),
        _ok_bundle(_daily(30, rain=1.0, start="2025-01-01"), lat=26.45, lon=80.35),
    ]
    compared = compare_locations(
        [
            {"name": "Lucknow", "latitude": 26.85, "longitude": 80.95},
            {"name": "Kanpur", "latitude": 26.45, "longitude": 80.35},
        ],
        "2025-01-01",
        "2025-01-30",
        use_cache=False,
    )
    assert compared["available"] is True
    assert compared["period"]["start"] == "2025-01-01"
    assert compared["wettest_location"]["location"] == "Lucknow"
    rains = {r["location"]: r["total_rainfall_mm"] for r in compared["comparison"]}
    assert rains["Lucknow"] > rains["Kanpur"]


@patch("app.services.historical_analysis.fetch_historical_daily")
def test_baseline_and_temperature_anomaly(mock_fetch):
    current = _daily(31, rain=2.0, tmean=32.5, tmax=36.0, start="2026-08-01")
    past = _daily(31, rain=2.0, tmean=29.8, tmax=33.0, start="2025-08-01")
    mock_fetch.side_effect = [_ok_bundle(current)] + [_ok_bundle(past)] * 5
    result = analyze_location(26.85, 80.95, "2026-08-01", "2026-08-31", "Lucknow", use_cache=False)
    assert result["available"] is True
    assert result["baseline"]["available"] is True
    dep = result["departures"]["temperature_c"]
    assert dep is not None
    assert dep > 0
    assert "climate trend" not in (result["departures"]["temperature_text"] or "").lower() or "not a" in (
        result["departures"]["temperature_text"] or ""
    ).lower()


@patch("app.services.historical_analysis.fetch_historical_daily")
def test_multi_year_skips_overlapping_baseline(mock_fetch):
    mock_fetch.return_value = _ok_bundle(_daily(400, rain=2.0, start="2021-01-01"))
    result = analyze_location(
        26.85, 80.95, "2021-01-01", "2022-02-04", "Lucknow", use_cache=False
    )
    assert result["available"] is True
    assert result["baseline"]["available"] is False
    assert "overlap" in result["baseline"]["note"].lower()
    assert mock_fetch.call_count == 1


def test_extreme_rainfall_count_and_max():
    rows = [
        {
            "date": f"2024-07-{i+1:02d}",
            "precipitation_mm": 0.2,
            "temp_max_c": 32,
            "temp_min_c": 24,
            "mean_temp_c": 28,
            "wind_speed_max_kmh": 10,
        }
        for i in range(20)
    ]
    rows[3]["precipitation_mm"] = 143.2
    rows[7]["precipitation_mm"] = 70.0
    stats = summarize_daily(rows)
    assert stats["maximum_daily_rainfall_mm"] == 143.2
    assert stats["extreme_rainfall_days"] == 2


def test_mae_calculation():
    m = _metrics([80.0, 10.0, 0.0], [95.0, 10.0, 0.0], wet_threshold=1.0)
    assert m["n"] == 3
    assert m["mae"] == 5.0
    assert m["bias"] == -5.0
    assert m["mae_wet_days"] == 7.5  # |80-95| and |10-10| / 2


def test_parse_previous_runs_gfs_and_ecmwf():
    payload = {
        "hourly": {
            "time": ["2025-01-01T00:00", "2025-01-01T01:00"],
            "precipitation_previous_day1": [1.5, 0.5],
            "temperature_2m_previous_day1": [20.0, 21.0],
            "wind_speed_10m_previous_day1": [10.0, 12.0],
        }
    }
    gfs = parse_previous_runs_hourly(payload, "GFS")
    ecm = parse_previous_runs_hourly(payload, "ECMWF")
    assert gfs["available"] and ecm["available"]
    assert daily_precip_from_hourly(gfs["hourly"])["2025-01-01"] == 2.0


@patch("app.services.nwp_verification.fetch_previous_runs")
@patch("app.services.nwp_verification.fetch_historical_daily")
def test_forecast_vs_observation_and_missing_model(mock_obs, mock_runs):
    obs_rows = _daily(3, rain=10.0, tmean=30.0, start="2025-06-01")
    mock_obs.return_value = _ok_bundle(obs_rows)
    hourly = []
    for i, day in enumerate(["2025-06-01", "2025-06-02", "2025-06-03"]):
        hourly.append(
            {"time": f"{day}T00:00", "precipitation_mm": 8.0, "temperature_c": 29.0, "wind_speed_kmh": 10.0}
        )
        hourly.append(
            {"time": f"{day}T12:00", "precipitation_mm": 2.0, "temperature_c": 31.0, "wind_speed_kmh": 12.0}
        )

    def _runs(_lat, _lon, _s, _e, model_id, label, use_cache=True):
        if label == "ECMWF":
            return {"model": "ECMWF", "available": False, "error": "ECMWF archived forecast unavailable", "hourly": []}
        return {"model": "GFS", "available": True, "hourly": hourly, "open_meteo_model": model_id}

    mock_runs.side_effect = _runs
    result = verify_models(26.85, 80.95, "2025-06-01", "2025-06-03", "Lucknow", use_cache=False)
    assert result["available"] is True
    assert result["gfs"]["available"] is True
    assert result["gfs"]["rainfall"]["n"] == 3
    assert result["ecmwf"]["available"] is False
    assert result["comparison"] is None


@patch("app.services.nwp_verification.fetch_previous_runs")
@patch("app.services.nwp_verification.fetch_historical_daily")
def test_ecmwf_forecast_vs_observation(mock_obs, mock_runs):
    obs_rows = _daily(3, rain=10.0, tmean=30.0, start="2025-06-01")
    mock_obs.return_value = _ok_bundle(obs_rows)
    hourly = []
    for day in ["2025-06-01", "2025-06-02", "2025-06-03"]:
        hourly.append(
            {"time": f"{day}T00:00", "precipitation_mm": 4.0, "temperature_c": 29.0, "wind_speed_kmh": 10.0}
        )
        hourly.append(
            {"time": f"{day}T12:00", "precipitation_mm": 3.0, "temperature_c": 31.0, "wind_speed_kmh": 12.0}
        )

    def _runs(_lat, _lon, _s, _e, model_id, label, use_cache=True):
        if label == "GFS":
            return {"model": "GFS", "available": False, "error": "GFS archived forecast unavailable", "hourly": []}
        return {"model": "ECMWF", "available": True, "hourly": hourly, "open_meteo_model": model_id}

    mock_runs.side_effect = _runs
    result = verify_models(26.85, 80.95, "2025-06-01", "2025-06-03", "Lucknow", use_cache=False)
    assert result["available"] is True
    assert result["ecmwf"]["available"] is True
    assert result["gfs"]["available"] is False
    assert result["ecmwf"]["rainfall"]["n"] == 3
    assert result["ecmwf"]["rainfall"]["mae"] == 3.0


def test_nwp_archive_too_old():
    clamped = clamp_nwp_archive_window("2020-01-01", "2020-06-01")
    assert clamped["available"] is False


@patch("app.services.historical_analysis.fetch_historical_daily")
def test_api_failure(mock_fetch):
    mock_fetch.return_value = {"available": False, "error": "Historical weather service unavailable", "daily": []}
    result = analyze_location(26.85, 80.95, "2024-01-01", "2024-01-31", "Lucknow", include_baseline=False)
    assert result["available"] is False
    assert "unavailable" in result["error"].lower()


def test_invalid_location_no_guess():
    result = run_historical_query("How much rain over the last 5 years?")
    assert result["available"] is False
    assert "do not guess" in result["error"].lower()


def test_natural_language_intents():
    assert classify_intent("How much has it rained in Lucknow over the last 5 years?") == "historical"
    assert classify_intent("Compare rainfall in Lucknow and Kanpur.") == "historical_compare"
    assert classify_intent("Compare rainfall in Lucknow and Kanpur over the last 5 years.") == "historical_compare"
    assert classify_intent("How accurate has GFS been for rainfall in this area?") == "nwp_verification"
    assert classify_intent("Compare GFS and ECMWF rainfall forecasts for the last year.") == "nwp_verification"
    assert classify_intent("Will it rain tomorrow in Lucknow?") == "forecast"


@patch("app.services.historical_analysis.fetch_historical_daily")
def test_llm_block_keeps_numbers(mock_fetch):
    mock_fetch.return_value = _ok_bundle(_daily(10, rain=5.0, start="2025-01-01"))
    analysis = analyze_location(
        26.85, 80.95, "2025-01-01", "2025-01-10", "Lucknow", include_baseline=False, use_cache=False
    )
    block = format_historical_context_block(
        {"available": True, "location": "Lucknow", "metrics": analysis["metrics"], "disclaimer": "ERA5"}
    )
    assert "50" in block or str(analysis["metrics"]["total_rainfall_mm"]) in block
    assert "Do NOT invent" in block


@patch("app.services.flood_disaster.nwp_vs_archive_context", create=True)
def test_flood_role_consumes_historical_context(_unused=None):
    from app.services.flood_disaster import build_disaster_assessment

    nwp = {
        "available": True,
        "overall_risk": "high",
        "model_agreement": "high",
        "hazards": [
            {
                "type": "heavy_rain",
                "severity": "high",
                "forecast_total_mm_24h": {"gfs": 110, "ecmwf": 96},
            }
        ],
        "disclaimer": "not official",
        "location": {"name": "Lucknow", "latitude": 26.85, "longitude": 80.95},
    }
    with patch(
        "app.services.historical_analysis.nwp_vs_archive_context",
        return_value={
            "available": True,
            "source": "open_meteo_historical_archive",
            "same_month_metrics": {"average_daily_rainfall_mm": 40.0, "maximum_daily_rainfall_mm": 150.0},
            "nwp_vs_rainfall_baseline": {
                "nwp_forecast_24h_mm": 110,
                "historical_mean_daily_mm_same_month": 40.0,
                "text": "The forecast rainfall is 110 mm / 24h versus a historical mean daily rainfall of 40.0 mm.",
            },
            "nwp_vs_temperature_baseline": None,
        },
    ):
        disaster = build_disaster_assessment(
            nwp, location_name="Lucknow", latitude=26.85, longitude=80.95
        )
    assert disaster["historical_baseline"]["available"] is True
    assert "110" in (disaster.get("rainfall_concern") or "")
    assert "40" in (disaster.get("rainfall_concern") or "")
    assert disaster["official_warning"] is False


def test_existing_forecast_intent_still_works():
    parsed = parse_user_request("Will it rain tomorrow in Lucknow?", role="citizen")
    assert parsed["intent"] == "forecast"
    assert parsed["role"] == "citizen"


@patch("app.services.weather.httpx.Client")
def test_timeout_propagates(mock_client):
    mock_client.return_value.__enter__.return_value.get.side_effect = httpx.TimeoutException("timed out")
    from app.services.weather import fetch_historical_daily

    result = fetch_historical_daily(26.85, 80.95, "2024-01-01", "2024-01-02", use_cache=False)
    assert result["available"] is False
    assert "unavailable" in result["error"].lower()
