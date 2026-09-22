"""Statistical anomaly detection — live observations vs supplied baseline only."""
from typing import Any, Dict, List, Optional

from scipy import stats

from app.schemas.anomaly import (
    AnomalyDetectResponse,
    AnomalyMetricResult,
    AnomalyType,
)


class AnomalyEngine:
    """Z-score analyzer. Does not invent observed or baseline weather values."""

    DEFAULT_BASELINE_PERIOD = "Caller-supplied historical baseline (ERA5/live archive)"

    @classmethod
    def analyze_anomalies(
        cls,
        location_name: str,
        observed_weather: Dict[str, Any],
        historical_baseline: Dict[str, Any],
        month_idx: int = 9,
        target_metric: Optional[AnomalyType] = None,
    ) -> AnomalyDetectResponse:
        month_names = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december",
        ]
        month_key = month_names[month_idx - 1]
        baseline_month = historical_baseline.get(month_key)
        if not isinstance(baseline_month, dict):
            baseline_month = {}
        # Prefer flat baseline keys when monthly buckets are absent
        if not baseline_month and historical_baseline.get("mean_temp") is not None:
            baseline_month = historical_baseline
        results: List[AnomalyMetricResult] = []

        if target_metric is None or target_metric == AnomalyType.TEMPERATURE:
            raw_temp = observed_weather.get("temperature")
            if raw_temp is not None and baseline_month.get("mean_temp") is not None:
                std = baseline_month.get("std_temp")
                if std is not None and float(std) > 0:
                    results.append(
                        cls._metric_result(
                            AnomalyType.TEMPERATURE,
                            float(raw_temp),
                            float(baseline_month["mean_temp"]),
                            float(std),
                            units="°C",
                        )
                    )

        if target_metric is None or target_metric == AnomalyType.RAINFALL:
            raw_rain = observed_weather.get("rainfall_total")
            if raw_rain is None:
                raw_rain = observed_weather.get("precipitation_mm")
            if raw_rain is not None and baseline_month.get("daily_mean_rainfall") is not None:
                std = baseline_month.get("daily_std_rainfall")
                if std is not None and float(std) > 0:
                    results.append(
                        cls._metric_result(
                            AnomalyType.RAINFALL,
                            float(raw_rain),
                            float(baseline_month["daily_mean_rainfall"]),
                            float(std),
                            units="mm",
                            range_min=0.0,
                        )
                    )

        if not results:
            interpretation = (
                f"Anomaly analysis unavailable for {location_name}: observed values or "
                "baseline mean/std missing. Hardcoded normals are not used."
            )
        else:
            narratives = []
            for item in results:
                sign = "+" if item.departure_absolute > 0 else ""
                narratives.append(
                    f"{item.metric.value}: {sign}{item.departure_absolute}{item.units} "
                    f"(Z={item.z_score}, {item.severity})"
                )
            interpretation = (
                f"Observed weather in {location_name} ({month_key}): " + "; ".join(narratives) + "."
            )

        return AnomalyDetectResponse(
            location_name=location_name,
            month_analyzed=month_key.capitalize(),
            baseline_period=cls.DEFAULT_BASELINE_PERIOD,
            anomalies_detected=sum(1 for item in results if item.is_anomaly),
            results=results,
            interpretation=interpretation,
        )

    @classmethod
    def _metric_result(
        cls,
        metric: AnomalyType,
        observed: float,
        mean: float,
        std: float,
        units: str,
        range_min: Optional[float] = None,
        range_max: Optional[float] = None,
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
            expected_range_min=range_min if range_min is not None else round(mean - 1.5 * std, 1),
            expected_range_max=range_max if range_max is not None else round(mean + 1.5 * std, 1),
            departure_absolute=round(departure, 1),
            departure_percent=round((departure / mean) * 100, 1) if mean else 0.0,
            z_score=round(z_score, 2),
            percentile=round(min(100.0, max(0.0, percentile)), 1),
            is_anomaly=abs(z_score) >= 2.0,
            anomaly_direction=direction,
            severity=cls._classify_anomaly_severity(abs(z_score)),
            baseline_period=cls.DEFAULT_BASELINE_PERIOD,
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
