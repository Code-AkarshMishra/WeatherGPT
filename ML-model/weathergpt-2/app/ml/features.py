"""Meteorological feature extraction with aliases for Open-Meteo field names.

Missing values stay missing — never invent temperature, humidity, rain, wind, etc.
"""
from typing import Any, Optional


class FeatureExtractor:
    """Extracts and validates meteorological feature vectors from live payloads."""

    NORM_BOUNDS = {
        "temperature": (-10.0, 50.0),
        "feels_like": (-10.0, 55.0),
        "humidity": (0.0, 100.0),
        "rainfall_rate": (0.0, 100.0),
        "rainfall_total": (0.0, 300.0),
        "precipitation_probability": (0.0, 100.0),
        "wind_speed": (0.0, 150.0),
        "wind_gust": (0.0, 200.0),
        "pressure": (950.0, 1050.0),
        "visibility": (0.0, 10.0),
        "cloud_cover": (0.0, 100.0),
        "uv_index": (0.0, 15.0),
        "storm_indicator": (0.0, 1.0),
        "official_warning_severity": (0.0, 3.0),
    }

    SEVERITY_MAP = {
        "GREEN": 0.0,
        "YELLOW": 1.0,
        "ORANGE": 2.0,
        "RED": 3.0,
    }

    FIELD_ALIASES = {
        "temperature": ("temperature", "temperature_c"),
        "feels_like": ("feels_like", "feels_like_c", "apparent_temperature"),
        "humidity": ("humidity", "humidity_percent", "relative_humidity_2m"),
        "rainfall_rate": ("rainfall_rate", "rain_mm", "precipitation_mm", "precipitation"),
        "rainfall_total": ("rainfall_total", "precipitation_sum", "precipitation_mm"),
        "precipitation_probability": (
            "precipitation_probability",
            "precipitation_probability_max",
        ),
        "wind_speed": ("wind_speed", "wind_speed_kmh", "wind_speed_10m"),
        "wind_gust": ("wind_gust", "wind_speed_max_kmh"),
        "pressure": ("pressure", "surface_pressure"),
        "visibility": ("visibility",),
        "cloud_cover": ("cloud_cover", "cloud_cover_percent"),
        "uv_index": ("uv_index",),
        "condition": ("condition",),
    }

    @classmethod
    def pick(cls, payload: dict[str, Any], *keys: str, default: Any = None) -> Any:
        for key in keys:
            if payload.get(key) is not None:
                return payload[key]
        return default

    @classmethod
    def extract_features(
        cls,
        weather: Optional[dict[str, Any]] = None,
        forecast: Optional[list[dict[str, Any]]] = None,
        alerts: Optional[list[dict[str, Any]]] = None,
    ) -> tuple[dict[str, float], dict[str, bool]]:
        weather = weather or {}
        forecast = forecast or []
        alerts = alerts or []
        first_forecast = forecast[0] if forecast else {}

        features: dict[str, float] = {}
        missing_flags: dict[str, bool] = {}

        def assign(name: str, value: Any) -> None:
            if value is not None:
                try:
                    features[name] = float(value)
                    missing_flags[name] = False
                except (TypeError, ValueError):
                    missing_flags[name] = True
            else:
                missing_flags[name] = True

        assign("temperature", cls.pick(weather, *cls.FIELD_ALIASES["temperature"]))
        assign(
            "feels_like",
            cls.pick(weather, *cls.FIELD_ALIASES["feels_like"])
            if cls.pick(weather, *cls.FIELD_ALIASES["feels_like"]) is not None
            else features.get("temperature"),
        )
        assign("humidity", cls.pick(weather, *cls.FIELD_ALIASES["humidity"]))
        assign("rainfall_rate", cls.pick(weather, *cls.FIELD_ALIASES["rainfall_rate"]))

        rainfall_total = cls.pick(weather, *cls.FIELD_ALIASES["rainfall_total"])
        if rainfall_total is None:
            rainfall_total = cls.pick(
                first_forecast, "rainfall_total", "precipitation_mm"
            )
        assign("rainfall_total", rainfall_total)

        pop = cls.pick(weather, *cls.FIELD_ALIASES["precipitation_probability"])
        if pop is None:
            pop = cls.pick(
                first_forecast,
                "precipitation_probability",
                "precipitation_probability_max",
            )
        assign("precipitation_probability", pop)

        assign("wind_speed", cls.pick(weather, *cls.FIELD_ALIASES["wind_speed"]))
        gust = cls.pick(weather, *cls.FIELD_ALIASES["wind_gust"])
        assign("wind_gust", gust)
        assign("pressure", cls.pick(weather, *cls.FIELD_ALIASES["pressure"]))
        assign("visibility", cls.pick(weather, *cls.FIELD_ALIASES["visibility"]))
        assign("cloud_cover", cls.pick(weather, *cls.FIELD_ALIASES["cloud_cover"]))
        assign("uv_index", cls.pick(weather, *cls.FIELD_ALIASES["uv_index"]))

        cond_str = str(cls.pick(weather, "condition") or "").lower()
        if any(word in cond_str for word in ("thunder", "storm", "squall", "cyclon")):
            features["storm_indicator"] = 1.0
            missing_flags["storm_indicator"] = False
        elif (
            features.get("wind_gust") is not None
            and features.get("pressure") is not None
            and features["wind_gust"] > 50
            and features["pressure"] < 1000
        ):
            features["storm_indicator"] = 0.8
            missing_flags["storm_indicator"] = False
        elif cond_str or features.get("wind_gust") is not None:
            features["storm_indicator"] = 0.0
            missing_flags["storm_indicator"] = False
        else:
            missing_flags["storm_indicator"] = True

        max_severity = 0.0
        for alert in alerts:
            sev_str = str(alert.get("severity") or "").upper()
            score = cls.SEVERITY_MAP.get(sev_str, 0.0)
            if score > max_severity:
                max_severity = score
        features["official_warning_severity"] = max_severity
        missing_flags["official_warning_severity"] = False

        return features, missing_flags

    @classmethod
    def normalize_features(cls, features: dict[str, float]) -> dict[str, float]:
        norm: dict[str, float] = {}
        for key, value in features.items():
            if key in cls.NORM_BOUNDS:
                min_v, max_v = cls.NORM_BOUNDS[key]
                clamped = max(min_v, min(max_v, value))
                norm[key] = (clamped - min_v) / (max_v - min_v) if max_v > min_v else 0.0
            else:
                norm[key] = value
        return norm
