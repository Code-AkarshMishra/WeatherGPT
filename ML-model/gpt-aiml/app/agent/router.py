"""Tool router determining optimal execution plan."""
from typing import List
from app.agent.entities import ExtractedEntities
from app.agent.intent import UserIntent


class ToolRouter:
    """Selects the minimal set of tools required for grounded answering."""

    @classmethod
    def select_tools(cls, intent: UserIntent, entities: ExtractedEntities) -> List[str]:
        """Return list of tool names to execute."""
        if intent == UserIntent.CURRENT_WEATHER:
            return ["get_current_weather", "get_alerts"]

        elif intent == UserIntent.FORECAST:
            return ["get_forecast", "get_current_weather", "get_alerts"]

        elif intent == UserIntent.ALERT_INQUIRY:
            return ["get_alerts", "get_current_weather"]

        elif intent == UserIntent.RISK_ASSESSMENT:
            return ["get_current_weather", "get_forecast", "get_alerts", "get_risk_score"]

        elif intent == UserIntent.ADVISORY_REQUEST:
            return ["get_current_weather", "get_forecast", "get_alerts", "get_advisory", "get_risk_score"]

        elif intent == UserIntent.CLIMATE_TREND:
            return ["get_climate_trend", "get_historical_weather"]

        elif intent == UserIntent.ANOMALY_INQUIRY:
            return ["get_current_weather", "get_historical_weather"]

        elif intent == UserIntent.HISTORICAL:
            return ["get_historical_weather", "get_climate_trend"]

        elif intent == UserIntent.COMPARISON:
            return ["get_current_weather", "get_alerts"]

        else:
            return ["get_current_weather", "get_alerts"]
