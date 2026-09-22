"""Z-score / percentile anomaly detection against climatological normals."""
from typing import Any, Optional

from scipy import stats

from app.models.anomaly import AnomalyDetectResponse, AnomalyMetricResult, AnomalyType


class AnomalyEngine:
    """Compares observed weather against monthly baseline mean/std."""

    DEFAULT_BASELINE_PERIOD = "ERA5 same-month reanalysis (when provided by caller)"

    @classmethod
    def analyze_anomalies(
        cls,
        location_name: str,
        observed_weather: dict[str, Any],
        historical_baseline: dict[str, Any],
        month_idx: int = 9,
        target_metric: Optional[AnomalyType] = None,
        source_notes: Optional[str] = None,
        baseline_period: Optional[str] = None,
    ) -> AnomalyDetectResponse:
        month_names = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december",
        ]
        month_key = month_names[month_idx - 1]
        baseline_month = historical_baseline.get(month_key)
        if not isinstance(baseline_month, dict):
            baseline_month = {}
        if not baseline_month and historical_baseline.get("mean_temp") is not None:
            baseline_month = historical_baseline
        period = baseline_period or cls.DEFAULT_BASELINE_PERIOD
        results: list[AnomalyMetricResult] = []

        if target_metric is None or target_metric == AnomalyType.TEMPERATURE:
            raw_temp = observed_weather.get("temperature")
            if raw_temp is None:
                raw_temp = observed_weather.get("temperature_c")
            if raw_temp is not None and baseline_month.get("mean_temp") is not None:
                obs_temp = float(raw_temp)
                base_temp_mean = float(baseline_month["mean_temp"])
                if baseline_month.get("std_temp") is None:
                    pass  # skip temperature anomaly without a real std
                else:
                    base_temp_std = float(baseline_month["std_temp"])
                    if base_temp_std > 0:
                        results.append(
                            cls._metric_result(
                                AnomalyType.TEMPERATURE,
                                obs_temp,
                                base_temp_mean,
                                base_temp_std,
                                units="°C",
                                range_min=round(base_temp_mean - 1.5 * base_temp_std, 1),
                                range_max=round(base_temp_mean + 1.5 * base_temp_std, 1),
                                baseline_period=period,
                            )
                        )

        if target_metric is None or target_metric == AnomalyType.RAINFALL:
            raw_rain = observed_weather.get("rainfall_total")
            if raw_rain is None:
                raw_rain = observed_weather.get("precipitation_mm")
            if raw_rain is None and observed_weather.get("rainfall_rate") is not None:
                raw_rain = float(observed_weather["rainfall_rate"])
            if raw_rain is not None and baseline_month.get("daily_mean_rainfall") is not None:
                obs_rain = float(raw_rain)
                base_rain_mean = float(baseline_month["daily_mean_rainfall"])
                if baseline_month.get("daily_std_rainfall") is None:
                    pass
                else:
                    base_rain_std = float(baseline_month["daily_std_rainfall"])
                    if base_rain_std > 0:
                        results.append(
                            cls._metric_result(
                                AnomalyType.RAINFALL,
                                obs_rain,
                                base_rain_mean,
                                base_rain_std,
                                units="mm",
                                range_min=0.0,
                                range_max=round(base_rain_mean + 2.0 * base_rain_std, 1),
                                baseline_period=period,
                            )
                        )

        anomalies_count = sum(1 for item in results if item.is_anomaly)
        if not results:
            interpretation = (
                f"Insufficient observed values or ERA5 baseline fields for {location_name} "
                f"({month_key}). No anomaly metrics were fabricated."
            )
        else:
            narratives = []
            for item in results:
                sign = "+" if item.departure_absolute > 0 else ""
                narratives.append(
                    f"{item.metric.value.capitalize()} is {sign}{item.departure_absolute}"
                    f"{item.units} vs ERA5 same-month mean (Z-Score: {item.z_score}, "
                    f"{item.severity} departure)"
                )
            interpretation = (
                f"Observed weather in {location_name} for {month_key.capitalize()}: "
                + "; ".join(narratives)
                + "."
            )

        return AnomalyDetectResponse(
            location_name=location_name,
            month_analyzed=month_key.capitalize(),
            baseline_period=period,
            anomalies_detected=anomalies_count,
            results=results,
            interpretation=interpretation,
            source_notes=source_notes,
        )

    @classmethod
    def _metric_result(
        cls,
        metric: AnomalyType,
        observed: float,
        mean: float,
        std: float,
        units: str,
        range_min: float,
        range_max: float,
        baseline_period: Optional[str] = None,
    ) -> AnomalyMetricResult:
        z_score = (observed - mean) / std
        percentile = float(stats.norm.cdf(z_score) * 100.0)
        departure = observed - mean
        direction = (
            "above_normal"
            if z_score > 0.5
            else ("below_normal" if z_score < -0.5 else "normal")
        )
        return AnomalyMetricResult(
            metric=metric,
            observed_value=round(observed, 1),
            baseline_mean=round(mean, 1),
            baseline_std=round(std, 1),
            expected_range_min=range_min,
            expected_range_max=range_max,
            departure_absolute=round(departure, 1),
            departure_percent=round((departure / mean) * 100, 1) if mean else 0.0,
            z_score=round(z_score, 2),
            percentile=round(min(100.0, max(0.0, percentile)), 1),
            is_anomaly=abs(z_score) >= 2.0,
            anomaly_direction=direction,
            severity=cls._classify_anomaly_severity(abs(z_score)),
            baseline_period=baseline_period or cls.DEFAULT_BASELINE_PERIOD,
            units=units,
        )

    @staticmethod
    def _classify_anomaly_severity(abs_z: float) -> str:
        if abs_z >= 3.0:
            return "EXTREME"
        if abs_z >= 2.0:
            return "SIGNIFICANT"
        if abs_z >= 1.0:
            return "SLIGHT"
        return "NONE"
