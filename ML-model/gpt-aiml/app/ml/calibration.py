"""Confidence calibration for meteorological risk and prediction models."""
from typing import Dict


class ConfidenceCalibrator:
    """Calculates grounded confidence score based on feature availability and data quality."""

    @staticmethod
    def calculate_confidence(
        missing_flags: Dict[str, bool],
        has_official_alert: bool = False,
        is_fallback_source: bool = False
    ) -> float:
        """Calibrate confidence in [0.50, 0.99] range."""
        total_features = len(missing_flags)
        if total_features == 0:
            return 0.70

        missing_count = sum(1 for v in missing_flags.values() if v)
        completeness_ratio = (total_features - missing_count) / total_features

        # Base confidence starts between 0.70 and 0.95 depending on completeness
        confidence = 0.70 + (completeness_ratio * 0.25)

        # Boost confidence if official IMD alert is present and matches
        if has_official_alert:
            confidence = min(0.98, confidence + 0.04)

        # Penalize if using generic fallback station
        if is_fallback_source:
            confidence = max(0.55, confidence - 0.15)

        return round(confidence, 2)
