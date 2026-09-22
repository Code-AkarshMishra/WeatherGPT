"""Confidence calibration for meteorological risk scores."""


class ConfidenceCalibrator:
    """Calibrates confidence in [0.50, 0.99] from data completeness."""

    @staticmethod
    def calculate_confidence(
        missing_flags: dict[str, bool],
        has_official_alert: bool = False,
        is_fallback_source: bool = False,
    ) -> float:
        total_features = len(missing_flags)
        if total_features == 0:
            return 0.70

        missing_count = sum(1 for value in missing_flags.values() if value)
        completeness_ratio = (total_features - missing_count) / total_features
        confidence = 0.70 + (completeness_ratio * 0.25)

        if has_official_alert:
            confidence = min(0.98, confidence + 0.04)
        if is_fallback_source:
            confidence = max(0.55, confidence - 0.15)

        return round(confidence, 2)
