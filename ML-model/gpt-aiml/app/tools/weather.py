"""Current weather observation tool."""
from datetime import datetime
from typing import Any, Dict, Optional
from app.schemas.common import GeoLocation
from app.tools.base import BaseWeatherTool


class CurrentWeatherTool(BaseWeatherTool):
    """Retrieves verified current weather observations."""

    def __init__(self):
        super().__init__(
            name="get_current_weather",
            description="Retrieve latest verified temperature, humidity, rainfall rate, wind, and atmospheric conditions for a location."
        )
        from app.services.open_meteo import get_open_meteo_service
        self.open_meteo = get_open_meteo_service()

    async def execute(
        self,
        location: Optional[GeoLocation] = None,
        context_override: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Fetch current weather from supplied context or Open-Meteo live API only."""
        if context_override and len(context_override) > 0:
            return {
                "status": "success",
                "source_type": "backend_context",
                "location": location.model_dump() if location else {},
                "data": context_override,
                "retrieved_at": datetime.utcnow().isoformat() + "Z",
            }

        if location and location.lat is not None and location.lon is not None:
            live_data = await self.open_meteo.get_current_weather(location)
            if live_data:
                return {
                    "status": "success",
                    "source_type": "open_meteo_live_observation",
                    "location": location.model_dump(),
                    "data": live_data,
                    "retrieved_at": datetime.utcnow().isoformat() + "Z",
                }
            return self.unavailable(
                reason="Live current weather unavailable from Open-Meteo.",
                location=location,
                source_type="open_meteo_error",
            )

        return self.unavailable(
            reason="Coordinates required for live current weather. Mock station data is not used.",
            location=location,
        )
