from google.genai import types

TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="search_location",
        description=(
            "Convert a place name into geographic coordinates. "
            "Use this when the user mentions a city or place and you need lat/lon."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "location_name": types.Schema(
                    type=types.Type.STRING,
                    description="City or place name, e.g. Lucknow",
                ),
            },
            required=["location_name"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_current_weather",
        description=(
            "Get the current weather for a location using latitude and longitude. "
            "Use this for questions about weather right now / today currently."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "latitude": types.Schema(
                    type=types.Type.NUMBER,
                    description="Latitude in decimal degrees",
                ),
                "longitude": types.Schema(
                    type=types.Type.NUMBER,
                    description="Longitude in decimal degrees",
                ),
            },
            required=["latitude", "longitude"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_forecast",
        description=(
            "Get a weather forecast for upcoming days using latitude and longitude. "
            "Use this for questions about tomorrow, later today in a future sense, "
            "this week, or whether it will rain/be hot on a future day."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "latitude": types.Schema(
                    type=types.Type.NUMBER,
                    description="Latitude in decimal degrees",
                ),
                "longitude": types.Schema(
                    type=types.Type.NUMBER,
                    description="Longitude in decimal degrees",
                ),
                "days": types.Schema(
                    type=types.Type.INTEGER,
                    description="Number of forecast days from 1 to 7. Default 3.",
                ),
            },
            required=["latitude", "longitude"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_alerts",
        description=(
            "Get official weather warnings/alerts only when the backend supplied them "
            "(alert_context). If none are configured, reports unavailable — does not invent IMD alerts."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "location_name": types.Schema(
                    type=types.Type.STRING,
                    description="City or place name",
                ),
            },
            required=["location_name"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_risk_score",
        description=(
            "Compute a 0-100 multi-hazard risk score (heat, heavy rain, thunderstorm, "
            "high wind, fog, cold wave, or composite) from live weather plus any alerts."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "location_name": types.Schema(type=types.Type.STRING),
                "latitude": types.Schema(type=types.Type.NUMBER),
                "longitude": types.Schema(type=types.Type.NUMBER),
                "hazard": types.Schema(
                    type=types.Type.STRING,
                    description=(
                        "One of: heat, heavy_rain, thunderstorm, high_wind, "
                        "fog_visibility, cold_wave, composite"
                    ),
                ),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_advisory",
        description=(
            "Generate a structured advisory for agriculture, travel, disaster, "
            "or urban_general based on weather and alerts."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "location_name": types.Schema(type=types.Type.STRING),
                "latitude": types.Schema(type=types.Type.NUMBER),
                "longitude": types.Schema(type=types.Type.NUMBER),
                "domain": types.Schema(
                    type=types.Type.STRING,
                    description="agriculture, travel, disaster, or urban_general",
                ),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_historical_weather",
        description=(
            "Get weather for a specific past date (YYYY-MM-DD) from the Open-Meteo archive, "
            "or a date range. Prefer get_historical_analysis for multi-year stats or city comparison."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "location_name": types.Schema(type=types.Type.STRING),
                "latitude": types.Schema(type=types.Type.NUMBER),
                "longitude": types.Schema(type=types.Type.NUMBER),
                "date": types.Schema(
                    type=types.Type.STRING,
                    description="Past date YYYY-MM-DD",
                ),
                "month": types.Schema(
                    type=types.Type.STRING,
                    description="Month name such as september, if no exact date",
                ),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_climate_trend",
        description=(
            "Get multi-year ERA5 temperature/rainfall statistics for a place "
            "(Open-Meteo historical archive). Does not invent multi-decadal climate-change "
            "trends or p-values. Prefer get_historical_analysis for city comparison."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "location_name": types.Schema(type=types.Type.STRING),
                "metric": types.Schema(
                    type=types.Type.STRING,
                    description="temperature, rainfall, monsoon_onset, or extreme_events",
                ),
            },
            required=["location_name"],
        ),
    ),
    types.FunctionDeclaration(
        name="detect_anomaly",
        description=(
            "Compare current (or supplied) weather against ERA5 same-month statistics "
            "and return z-scores / whether it is unusual. Requires coordinates."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "location_name": types.Schema(type=types.Type.STRING),
                "latitude": types.Schema(type=types.Type.NUMBER),
                "longitude": types.Schema(type=types.Type.NUMBER),
                "metric": types.Schema(
                    type=types.Type.STRING,
                    description="temperature or rainfall; omit for both",
                ),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_nwp_hazard_assessment",
        description=(
            "Run a GFS + ECMWF NWP hazard screen for the next 24–48 hours "
            "(heavy rain, strong wind, convective environment). "
            "Use for alerts, hazard risk, early-warning, GFS/ECMWF, Flood & Disaster, "
            "or disaster-preparedness questions. "
            "Results are NOT official IMD warnings and do not predict floods or cyclones."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "latitude": types.Schema(type=types.Type.NUMBER),
                "longitude": types.Schema(type=types.Type.NUMBER),
                "location_name": types.Schema(type=types.Type.STRING),
                "role": types.Schema(
                    type=types.Type.STRING,
                    description="citizen, farmer, flood_disaster, aviation, marine, urban_planner, ...",
                ),
            },
            required=["latitude", "longitude"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_historical_analysis",
        description=(
            "ERA5 reanalysis statistics for a period (totals, extremes, baseline, "
            "optional multi-city comparison). Use for last N years, unusually high, "
            "how often heavy rain, or compare cities. Not a climate-change attribution."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "message": types.Schema(type=types.Type.STRING),
                "location_name": types.Schema(type=types.Type.STRING),
                "latitude": types.Schema(type=types.Type.NUMBER),
                "longitude": types.Schema(type=types.Type.NUMBER),
                "include_verification": types.Schema(type=types.Type.BOOLEAN),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="get_nwp_verification",
        description=(
            "Compare archived GFS and ECMWF 24h-lead forecasts with ERA5 reanalysis "
            "for a location and period (MAE/bias). Skill is not universal."
        ),
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "latitude": types.Schema(type=types.Type.NUMBER),
                "longitude": types.Schema(type=types.Type.NUMBER),
                "location_name": types.Schema(type=types.Type.STRING),
                "start_date": types.Schema(type=types.Type.STRING),
                "end_date": types.Schema(type=types.Type.STRING),
                "message": types.Schema(type=types.Type.STRING),
            },
            required=["latitude", "longitude"],
        ),
    ),
]


def get_gemini_tools() -> list[types.Tool]:
    return [types.Tool(function_declarations=TOOL_DECLARATIONS)]
