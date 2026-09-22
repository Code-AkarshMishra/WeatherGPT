"""Deterministic multi-hazard risk engine (model_version: rule-v1)."""
from typing import Any, Optional

from app.ml.calibration import ConfidenceCalibrator
from app.ml.features import FeatureExtractor
from app.models.risk import ContributingFactor, HazardType, RiskLevel, RiskScoreResponse


class RuleBasedRiskEngine:
    """Transparent, deterministic multi-hazard meteorological risk engine."""

    MODEL_VERSION = "rule-v1"

    HAZARD_WEIGHTS = {
        HazardType.HEAT: {
            "feels_like": 0.35,
            "temperature": 0.30,
            "humidity": 0.15,
            "uv_index": 0.10,
            "official_warning_severity": 0.10,
        },
        HazardType.HEAVY_RAIN: {
            "rainfall_rate": 0.35,
            "rainfall_total": 0.25,
            "precipitation_probability": 0.20,
            "storm_indicator": 0.10,
            "official_warning_severity": 0.10,
        },
        HazardType.THUNDERSTORM: {
            "storm_indicator": 0.35,
            "wind_gust": 0.25,
            "rainfall_rate": 0.15,
            "pressure": 0.15,
            "official_warning_severity": 0.10,
        },
        HazardType.HIGH_WIND: {
            "wind_gust": 0.45,
            "wind_speed": 0.35,
            "storm_indicator": 0.10,
            "official_warning_severity": 0.10,
        },
        HazardType.FOG_VISIBILITY: {
            "visibility": 0.50,
            "humidity": 0.30,
            "wind_speed": 0.10,
            "official_warning_severity": 0.10,
        },
        HazardType.COLD_WAVE: {
            "temperature": 0.45,
            "wind_speed": 0.30,
            "humidity": 0.15,
            "official_warning_severity": 0.10,
        },
        HazardType.COMPOSITE: {
            "rainfall_rate": 0.20,
            "feels_like": 0.20,
            "wind_gust": 0.20,
            "storm_indicator": 0.20,
            "official_warning_severity": 0.20,
        },
    }

    @classmethod
    def evaluate(
        cls,
        hazard: HazardType,
        weather: Optional[dict[str, Any]] = None,
        forecast: Optional[list[dict[str, Any]]] = None,
        alerts: Optional[list[dict[str, Any]]] = None,
        source_notes: Optional[str] = None,
    ) -> RiskScoreResponse:
        weather = weather or {}
        forecast = forecast or []
        alerts = alerts or []

        features, missing_flags = FeatureExtractor.extract_features(
            weather, forecast, alerts
        )
        weights = cls.HAZARD_WEIGHTS.get(hazard, cls.HAZARD_WEIGHTS[HazardType.COMPOSITE])
        usable = [
            name
            for name in weights
            if name in features and not missing_flags.get(name, True)
        ]
        # Always allow official_warning_severity when alerts were passed.
        if not usable and not alerts and not any(
            not missing_flags.get(k, True) for k in features
        ):
            return RiskScoreResponse(
                available=False,
                hazard=hazard,
                score=None,
                level=None,
                confidence=0.0,
                model_version=cls.MODEL_VERSION,
                factors=[],
                official_warning=False,
                explanation=(
                    "Risk score unavailable: no live meteorological inputs were provided. "
                    "Missing fields are not replaced with default weather values."
                ),
                source_notes=source_notes,
                input_variables={"_missing_flags": missing_flags},
                feature_weights=weights,
            )

        norm_features = FeatureExtractor.normalize_features(features)

        relevant_alerts = []
        for alert in alerts:
            al_hazard = (alert.get("hazard") or "").lower()
            if (
                hazard == HazardType.COMPOSITE
                or al_hazard in hazard.value
                or hazard.value in al_hazard
            ):
                relevant_alerts.append(alert)

        has_official_warning = len(relevant_alerts) > 0
        raw_score = 0.0
        factors: list[ContributingFactor] = []
        weight_sum = 0.0

        for feat_name, weight in weights.items():
            if feat_name not in features or missing_flags.get(feat_name, True):
                continue
            weight_sum += weight
            norm_val = norm_features.get(feat_name, 0.0)
            raw_val = features.get(feat_name)

            if feat_name == "visibility":
                risk_contribution = (1.0 - norm_val) * weight * 100.0
            elif feat_name == "pressure" and hazard == HazardType.THUNDERSTORM:
                risk_contribution = (1.0 - norm_val) * weight * 100.0
            elif feat_name == "temperature" and hazard == HazardType.COLD_WAVE:
                risk_contribution = (1.0 - norm_val) * weight * 100.0
            else:
                risk_contribution = norm_val * weight * 100.0

            raw_score += risk_contribution

            impact = "low"
            if risk_contribution >= 25.0:
                impact = "critical"
            elif risk_contribution >= 15.0:
                impact = "high"
            elif risk_contribution >= 8.0:
                impact = "moderate"

            if risk_contribution >= 5.0 or raw_score < 20:
                factors.append(
                    ContributingFactor(
                        feature=feat_name,
                        impact=impact,
                        observed_value=raw_val,
                        threshold=cls._get_threshold_str(feat_name),
                        contribution_points=round(risk_contribution, 1),
                    )
                )

        if weight_sum > 0 and weight_sum < 0.999:
            # Rescale so partial feature sets remain comparable on 0–100.
            raw_score = raw_score / weight_sum

        if has_official_warning:
            top_severity = str(relevant_alerts[0].get("severity", "YELLOW")).upper()
            if top_severity == "RED":
                raw_score = max(raw_score, 88.0)
            elif top_severity == "ORANGE":
                raw_score = max(raw_score, 65.0)
            elif top_severity == "YELLOW":
                raw_score = max(raw_score, 40.0)

        final_score = int(round(max(0, min(100, raw_score))))
        level = cls._classify_level(final_score)
        confidence = ConfidenceCalibrator.calculate_confidence(
            missing_flags=missing_flags,
            has_official_alert=has_official_warning,
            is_fallback_source=False,
        )
        factors.sort(key=lambda item: item.contribution_points or 0.0, reverse=True)

        return RiskScoreResponse(
            available=True,
            hazard=hazard,
            score=final_score,
            level=level,
            confidence=confidence,
            model_version=cls.MODEL_VERSION,
            factors=factors[:5],
            official_warning=has_official_warning,
            official_warning_details=relevant_alerts if has_official_warning else None,
            explanation=cls._build_explanation(
                hazard, final_score, level, factors, relevant_alerts
            ),
            source_notes=source_notes,
            input_variables={
                **features,
                "_missing_flags": missing_flags,
                "_normalized_features": norm_features,
            },
            feature_weights=weights,
        )

    @staticmethod
    def _classify_level(score: int) -> RiskLevel:
        if score >= 85:
            return RiskLevel.EXTREME
        if score >= 60:
            return RiskLevel.HIGH
        if score >= 30:
            return RiskLevel.MODERATE
        return RiskLevel.LOW

    @staticmethod
    def _get_threshold_str(feature: str) -> str:
        thresholds = {
            "rainfall_rate": ">15 mm/h (heavy rain threshold)",
            "feels_like": ">42°C (heat stress threshold)",
            "temperature": ">40°C (heatwave threshold)",
            "wind_gust": ">45 km/h (squall threshold)",
            "visibility": "<2.0 km (dense fog threshold)",
            "storm_indicator": "Active convective instability",
        }
        return thresholds.get(feature, "Standard meteorological threshold")

    @classmethod
    def _build_explanation(
        cls,
        hazard: HazardType,
        score: int,
        level: RiskLevel,
        factors: list[ContributingFactor],
        alerts: list[dict[str, Any]],
    ) -> str:
        top_factors = [
            f"{item.feature.replace('_', ' ')} ({item.observed_value})"
            for item in factors[:2]
        ]
        factor_str = (
            f"driven primarily by {', '.join(top_factors)}"
            if top_factors
            else "with nominal conditions"
        )
        alert_note = ""
        if alerts:
            top = alerts[0]
            alert_note = (
                f" Note: A {top.get('severity')} warning is in the bulletin set "
                f"('{top.get('headline')}')."
            )
        return (
            f"{level.value} {hazard.value.replace('_', ' ').title()} "
            f"Risk (Score {score}/100) {factor_str}.{alert_note}"
        )
