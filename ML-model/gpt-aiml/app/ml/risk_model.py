"""Deterministic Rule-based Risk Engine (model_version: rule-v1) and ML interface."""
from typing import Any, Dict, List, Optional, Tuple
from app.ml.calibration import ConfidenceCalibrator
from app.ml.features import FeatureExtractor
from app.schemas.risk import ContributingFactor, HazardType, RiskLevel, RiskScoreResponse


class RuleBasedRiskEngine:
    """Transparent, deterministic multi-hazard meteorological risk engine."""

    MODEL_VERSION = "rule-v1"

    # Hazard weight matrices and thresholds
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
            "pressure": 0.15,  # Low pressure contributes positively
            "official_warning_severity": 0.10,
        },
        HazardType.HIGH_WIND: {
            "wind_gust": 0.45,
            "wind_speed": 0.35,
            "storm_indicator": 0.10,
            "official_warning_severity": 0.10,
        },
        HazardType.FOG_VISIBILITY: {
            "visibility": 0.50,  # Lower visibility = higher risk
            "humidity": 0.30,    # Higher humidity = higher fog risk
            "wind_speed": 0.10,  # Low wind = higher fog stagnation
            "official_warning_severity": 0.10,
        },
        HazardType.COLD_WAVE: {
            "temperature": 0.45,  # Lower temp = higher risk
            "wind_speed": 0.30,   # Wind chill factor
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
        weather: Optional[Dict[str, Any]] = None,
        forecast: Optional[List[Dict[str, Any]]] = None,
        alerts: Optional[List[Dict[str, Any]]] = None,
    ) -> RiskScoreResponse:
        """Calculate grounded, deterministic risk score, category level, and contributing factors."""
        weather = weather or {}
        forecast = forecast or []
        alerts = alerts or []

        # 1. Feature Extraction & Normalization
        features, missing_flags = FeatureExtractor.extract_features(weather, forecast, alerts)
        norm_features = FeatureExtractor.normalize_features(features)

        # 2. Match relevant alerts
        relevant_alerts = []
        for alert in alerts:
            al_hazard = (alert.get("hazard") or "").lower()
            if hazard == HazardType.COMPOSITE or al_hazard in hazard.value or hazard.value in al_hazard:
                relevant_alerts.append(alert)

        has_official_warning = len(relevant_alerts) > 0

        # 3. Calculate Hazard Score
        weights = cls.HAZARD_WEIGHTS.get(hazard, cls.HAZARD_WEIGHTS[HazardType.COMPOSITE])
        raw_score = 0.0
        factors: List[ContributingFactor] = []

        for feat_name, weight in weights.items():
            norm_val = norm_features.get(feat_name, 0.0)
            raw_val = features.get(feat_name, 0.0)

            # Invert values where lower raw value means higher risk
            if feat_name == "visibility":
                # Inverted: 10km -> 0 risk, 0km -> 1.0 risk
                risk_contribution = (1.0 - norm_val) * weight * 100.0
            elif feat_name == "pressure" and hazard == HazardType.THUNDERSTORM:
                # Lower pressure -> higher cyclonic / convective risk
                risk_contribution = (1.0 - norm_val) * weight * 100.0
            elif feat_name == "temperature" and hazard == HazardType.COLD_WAVE:
                # Lower temperature -> higher cold wave risk
                risk_contribution = (1.0 - norm_val) * weight * 100.0
            else:
                risk_contribution = norm_val * weight * 100.0

            raw_score += risk_contribution

            # Determine factor impact level
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
                        threshold=cls._get_threshold_str(feat_name, raw_val),
                        contribution_points=round(risk_contribution, 1),
                    )
                )

        # Boost score if official warning is RED/ORANGE
        if has_official_warning:
            top_severity = relevant_alerts[0].get("severity", "YELLOW").upper()
            if top_severity == "RED":
                raw_score = max(raw_score, 88.0)
            elif top_severity == "ORANGE":
                raw_score = max(raw_score, 65.0)
            elif top_severity == "YELLOW":
                raw_score = max(raw_score, 40.0)

        # 4. Clamp & Assign Level
        final_score = int(round(max(0, min(100, raw_score))))
        level = cls._classify_level(final_score)

        # 5. Calibrate confidence
        confidence = ConfidenceCalibrator.calculate_confidence(
            missing_flags=missing_flags,
            has_official_alert=has_official_warning,
            is_fallback_source="fallback" in str(weather.get("source", "")).lower(),
        )

        # Sort factors by impact
        factors.sort(key=lambda f: f.contribution_points or 0.0, reverse=True)

        # 6. Generate explainability narrative
        explanation = cls._build_explanation(hazard, final_score, level, factors, relevant_alerts)

        return RiskScoreResponse(
            hazard=hazard,
            score=final_score,
            level=level,
            confidence=confidence,
            model_version=cls.MODEL_VERSION,
            factors=factors[:5],  # Top 5 factors
            official_warning=has_official_warning,
            official_warning_details=relevant_alerts if has_official_warning else None,
            explanation=explanation,
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
    def _get_threshold_str(feature: str, val: float) -> str:
        thresholds = {
            "rainfall_rate": ">15 mm/h (Heavy Rain threshold)",
            "feels_like": ">42°C (Heat Stress threshold)",
            "temperature": ">40°C (Heatwave threshold)",
            "wind_gust": ">45 km/h (Squall threshold)",
            "visibility": "<2.0 km (Dense Fog threshold)",
            "storm_indicator": "Active convective instability",
        }
        return thresholds.get(feature, "Standard meteorological threshold")

    @classmethod
    def _build_explanation(
        cls,
        hazard: HazardType,
        score: int,
        level: RiskLevel,
        factors: List[ContributingFactor],
        alerts: List[Dict[str, Any]],
    ) -> str:
        top_factors = [f"{f.feature.replace('_', ' ')} ({f.observed_value})" for f in factors[:2]]
        factor_str = f"driven primarily by {', '.join(top_factors)}" if top_factors else "with nominal conditions"

        alert_note = ""
        if alerts:
            top = alerts[0]
            alert_note = f" Note: An active official IMD {top.get('severity')} warning is in effect ('{top.get('headline')}')."

        return (
            f"{level.value} {hazard.value.replace('_', ' ').title()} Risk (Score {score}/100) {factor_str}.{alert_note}"
        )
