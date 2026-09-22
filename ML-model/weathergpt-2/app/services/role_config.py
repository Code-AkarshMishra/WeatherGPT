"""Single source of truth for every UI role — variables, indicators, safety rules."""
from app.services.roles import UserRole

ROLE_CONFIG: dict[str, dict] = {
    "citizen": {
        "label": "Citizen",
        "priorities": ["everyday_weather", "outdoor_activity", "travel", "personal_comfort"],
        "variables": [
            "temperature",
            "feels_like",
            "precipitation",
            "precipitation_probability",
            "wind",
            "wind_gusts",
            "thunderstorm",
            "uv",
            "humidity",
        ],
        "indicators": [
            "rain_risk",
            "heat_risk",
            "storm_risk",
            "outdoor_activity_risk",
            "travel_disruption_risk",
        ],
        "critical_missing": [],
        "forbidden": ["it is definitely safe", "you must go", "cancel for sure"],
        "safety_rule": (
            "Condition everyday advice on rain/wind timing and how long the person will be outdoors."
        ),
        "response_guidance": (
            "Structure: weather outlook → impact on the activity → what to do → when conditions "
            "are better or worse. Avoid absolute go/cancel statements."
        ),
    },
    "farmer": {
        "label": "Farmer / Crop Advisory",
        "priorities": [
            "crop_protection",
            "harvesting",
            "sowing",
            "irrigation",
            "spraying",
            "field_operations",
        ],
        "variables": [
            "precipitation",
            "precipitation_probability",
            "wind",
            "wind_gusts",
            "temperature",
            "humidity",
            "dew_point",
            "et0",
            "soil_moisture",
            "thunderstorm",
        ],
        "indicators": [
            "harvest_risk",
            "lodging_risk",
            "shattering_risk",
            "waterlogging_risk",
            "spraying_suitability",
            "irrigation_need",
            "fungal_disease_weather_risk",
            "heat_stress",
            "frost_risk",
            "field_work_suitability",
            "post_harvest_drying_risk",
        ],
        "critical_missing": ["crop_type"],
        "forbidden": ["yes, harvest today", "tomorrow is good for spraying"],
        "safety_rule": (
            "Never give crop-specific advice if crop type is unknown when it materially affects "
            "the decision. Ask 'Which crop are you growing?' before a strong recommendation. "
            "Never a blanket yes/no for harvest/spray/irrigate."
        ),
        "response_guidance": (
            "Use rain amount, wind/gusts, and timing — not probability alone. State assumptions, "
            "safest operational window, and what to avoid if work cannot finish and be stored dry."
        ),
    },
    "researcher": {
        "label": "Researcher",
        "priorities": ["data_analysis", "historical_weather", "comparisons", "trends", "datasets"],
        "variables": [
            "temperature",
            "precipitation",
            "precipitation_probability",
            "wind",
            "humidity",
            "pressure",
            "cloud_cover",
            "et0",
            "soil_moisture",
        ],
        "indicators": ["data_completeness"],
        "critical_missing": [],
        "forbidden": ["farmers should prepare for flooding"],
        "safety_rule": (
            "Prioritize data, method, comparison, trend, uncertainty, and limitations. "
            "Do not turn every answer into an operational advisory unless asked."
        ),
        "response_guidance": (
            "Lead with measured/forecast values and source. Mention completeness and what cannot "
            "be inferred from the available series."
        ),
    },
    "aviation": {
        "label": "Aviation",
        "priorities": ["visibility", "wind", "thunderstorms", "cloud_base", "flight_conditions"],
        "variables": [
            "wind",
            "wind_gusts",
            "wind_direction",
            "visibility",
            "cloud_cover",
            "precipitation",
            "thunderstorm",
            "pressure",
            "temperature",
            "humidity",
        ],
        "indicators": [
            "visibility_risk",
            "thunderstorm_risk",
            "flight_weather_risk",
            "wind_risk",
            "ceiling_risk",
        ],
        "critical_missing": [],
        "forbidden": ["it is safe to fly", "cleared to fly", "you may take off"],
        "safety_rule": (
            "Decision-support only — never clearance. Do not say it is safe to fly. Direct the "
            "user to latest METAR/TAF and official aviation advisories."
        ),
        "response_guidance": (
            "Present operational hazards, forecast uncertainty, and what to verify with official "
            "aviation weather. No go/no-go without aircraft/airport/operator context."
        ),
    },
    "marine": {
        "label": "Marine",
        "priorities": ["wind", "waves", "visibility", "storms", "marine_operations"],
        "variables": [
            "wind",
            "wind_gusts",
            "wind_direction",
            "wave_height",
            "wave_period",
            "wave_direction",
            "visibility",
            "thunderstorm",
            "precipitation",
            "pressure",
        ],
        "indicators": [
            "rough_sea_risk",
            "strong_wind_risk",
            "thunderstorm_risk",
            "visibility_risk",
            "small_boat_risk",
            "marine_weather_risk",
        ],
        "critical_missing": ["vessel_type"],
        "forbidden": ["it is safe to sail", "safe for all boats"],
        "safety_rule": (
            "Ask for vessel/activity type when it materially affects advice. The same wind means "
            "different risk for a kayak vs a cargo ship."
        ),
        "response_guidance": (
            "Assess wind + waves + thunderstorms, identify an operational window, and give "
            "precautions. Avoid absolute go/no-go."
        ),
    },
    "climate_analyst": {
        "label": "Climate Analyst",
        "priorities": ["long_term_trends", "climate_normals", "anomalies", "extremes"],
        "variables": [
            "historical_temperature",
            "historical_precipitation",
            "climate_normals",
            "temperature",
            "precipitation",
        ],
        "indicators": ["climate_trend_signal"],
        "critical_missing": [],
        "forbidden": ["tomorrow will prove climate change"],
        "safety_rule": (
            "Do not confuse weather with climate. Tomorrow's temperature is weather; a baseline "
            "period mean is climate."
        ),
        "response_guidance": (
            "Structure: period analyzed → observed pattern → magnitude of change → comparison/"
            "baseline → interpretation → limitations."
        ),
    },
    "urban_planner": {
        "label": "Urban Planner",
        "priorities": ["urban_flooding", "heat", "stormwater", "infrastructure"],
        "variables": [
            "precipitation",
            "precipitation_probability",
            "rainfall_intensity",
            "temperature",
            "wind",
            "humidity",
            "thunderstorm",
        ],
        "indicators": [
            "urban_flood_risk",
            "heat_stress",
            "stormwater_pressure",
            "drainage_stress",
            "heat_island_risk",
            "infrastructure_weather_risk",
        ],
        "critical_missing": ["drainage_capacity"],
        "forbidden": ["this area will flood for certain"],
        "safety_rule": (
            "Translate weather into infrastructure implications. Short-duration rainfall intensity "
            "and drainage capacity matter more than a generic 'heavy rain' label."
        ),
        "response_guidance": (
            "Assess hazard, exposure, and planning considerations. Do not blanket cancel/proceed "
            "for events without site/crowd/duration caveats."
        ),
    },
    "air_quality": {
        "label": "Air Quality",
        "priorities": ["aqi", "pollutants", "dispersion", "exposure"],
        "variables": [
            "aqi",
            "pm25",
            "pm10",
            "no2",
            "o3",
            "so2",
            "co",
            "wind",
            "humidity",
            "precipitation",
            "temperature",
        ],
        "indicators": [
            "pollution_risk",
            "particulate_matter_risk",
            "dispersion_conditions",
            "ozone_risk",
            "rain_washout_effect",
            "stagnation_risk",
        ],
        "critical_missing": ["aq_measurements"],
        "forbidden": ["no rain so aqi will be bad", "the air is medically safe"],
        "safety_rule": (
            "Do not infer air quality purely from weather. Use AQ measurements/forecasts when "
            "available; weather is a supporting factor only. No medical diagnosis."
        ),
        "response_guidance": (
            "Assess pollutant levels, atmospheric dispersion, expected changes, then activity "
            "guidance conditional on sensitive groups vs general public."
        ),
    },
    "flood_disaster": {
        "label": "Flood & Disaster",
        "priorities": [
            "developing_hazards",
            "extreme_rainfall",
            "strong_wind",
            "thunderstorm_conditions",
            "extreme_heat",
            "cyclone_related_conditions",
            "official_warning_status",
        ],
        "variables": [
            "precipitation",
            "precipitation_probability",
            "rainfall_intensity",
            "wind",
            "wind_gusts",
            "pressure",
            "temperature",
            "humidity",
            "thunderstorm",
            "cloud_cover",
        ],
        "indicators": [
            "rain_risk",
            "waterlogging_risk",
            "storm_risk",
            "thunderstorm_risk",
            "wind_risk",
            "heat_risk",
        ],
        "critical_missing": [],
        "forbidden": [
            "a flood will occur",
            "a cyclone will hit",
            "this area will definitely flood",
            "evacuate immediately",
            "official warning issued",
        ],
        "safety_rule": (
            "Decision-support only. Never predict floods or cyclone landfall. Never fabricate "
            "official warnings. Keep Official warning separate from WeatherGPT NWP assessment. "
            "Do not issue evacuations or emergency orders."
        ),
        "response_guidance": (
            "Structure: situation → developing hazards → severity → forecast window → "
            "model agreement → practical advisory → official warning status. "
            "Use NWP numbers only. Rainfall may raise waterlogging concern in low-lying areas "
            "without claiming a flood will occur."
        ),
    },
}


def get_role_config(role: str | UserRole) -> dict:
    from app.services.roles import normalize_role

    if isinstance(role, UserRole):
        key = role.value
    else:
        key = normalize_role(role).value
    return ROLE_CONFIG.get(key, ROLE_CONFIG["citizen"])


def role_system_snippet(role: str | UserRole) -> str:
    cfg = get_role_config(role)
    return (
        f"User role: {cfg['label']}. Priorities: {', '.join(cfg['priorities'])}. "
        f"{cfg['safety_rule']} {cfg['response_guidance']}"
    )
