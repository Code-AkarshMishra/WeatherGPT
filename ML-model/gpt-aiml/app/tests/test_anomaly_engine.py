"""Unit tests for statistical anomaly detection engine."""
from app.ml.anomaly import AnomalyEngine
from app.schemas.anomaly import AnomalyType


def test_temperature_anomaly_high_departure():
    observed = {"temperature": 36.5, "rainfall_total": 0.0}
    baseline = {
        "september": {
            "mean_temp": 28.5,
            "std_temp": 1.5,
            "daily_mean_rainfall": 5.0,
            "daily_std_rainfall": 4.0,
        }
    }

    res = AnomalyEngine.analyze_anomalies(
        location_name="Lucknow",
        observed_weather=observed,
        historical_baseline=baseline,
        month_idx=9,
        target_metric=AnomalyType.TEMPERATURE,
    )

    assert len(res.results) == 1
    t_res = res.results[0]
    assert t_res.observed_value == 36.5
    assert t_res.departure_absolute == 8.0
    assert t_res.z_score >= 4.0
    assert t_res.is_anomaly is True
    assert t_res.severity == "EXTREME"
    assert t_res.anomaly_direction == "above_normal"


def test_normal_weather_no_anomaly():
    observed = {"temperature": 28.7, "rainfall_total": 5.2}
    baseline = {
        "september": {
            "mean_temp": 28.5,
            "std_temp": 1.5,
            "daily_mean_rainfall": 5.0,
            "daily_std_rainfall": 4.0,
        }
    }

    res = AnomalyEngine.analyze_anomalies(
        location_name="Lucknow",
        observed_weather=observed,
        historical_baseline=baseline,
        month_idx=9,
    )

    assert res.anomalies_detected == 0
    assert all(not r.is_anomaly for r in res.results)
