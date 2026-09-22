"""Unit tests for climate statistics from live archive (mocked HTTP)."""
from unittest.mock import patch

from app.models.climate import ClimateMetric, ClimateTrendRequest
from app.models.common import LocationQuery
from app.services.climate import analyze_climate
from app.services.intent import classify_intent


def _archive_rows():
    return {
        "available": True,
        "daily": [
            {
                "date": f"2024-06-{i+1:02d}",
                "precipitation_mm": 3.0,
                "temp_max_c": 34.0,
                "temp_min_c": 24.0,
                "mean_temp_c": 29.0,
                "wind_speed_max_kmh": 12.0,
            }
            for i in range(10)
        ],
        "dataset": "ERA5",
    }


@patch("app.services.climate.fetch_historical_daily", return_value=_archive_rows())
@patch(
    "app.services.climate.geocode_if_needed",
    return_value={"name": "Lucknow", "lat": 26.85, "lon": 80.95, "source": "test"},
)
def test_climate_trend_temperature(_geo, _fetch):
    res = analyze_climate(
        ClimateTrendRequest(
            location=LocationQuery(name="Lucknow", lat=26.85, lon=80.95),
            metric=ClimateMetric.TEMPERATURE,
            period_years=5,
        )
    )
    assert res.available is True
    assert res.metric == ClimateMetric.TEMPERATURE
    assert res.historical_mean == 29.0
    assert res.statistical_significance_p_value is None
    assert "not a long-term climate-change trend" in res.summary_narrative.lower()
    assert "not computed" in res.rate_of_change.lower()
    assert res.location_name == "Lucknow"


def test_climate_monsoon_unavailable():
    res = analyze_climate(
        ClimateTrendRequest(
            location=LocationQuery(name="Lucknow", lat=26.85, lon=80.95),
            metric=ClimateMetric.MONSOON_ONSET,
        )
    )
    assert res.available is False
    assert "does not invent" in res.summary_narrative.lower()


def test_intent_classifier():
    assert classify_intent("Will it rain tomorrow in Lucknow?") == "forecast"
    assert classify_intent("Should farmers spray pesticide today?") == "advisory_request"
    assert classify_intent("क्या कल बारिश होगी?") == "forecast"
    assert classify_intent("How will the weather be for the next 7 days in Lucknow?") == "forecast"
