"""Weather forecast retrieval tool."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from app.schemas.common import GeoLocation
from app.tools.base import BaseWeatherTool


class ForecastTool(BaseWeatherTool):
    """Retrieves multi-day and hourly meteorological forecast data."""

    def __init__(self):
        super().__init__(
            name="get_forecast",
            description="Retrieve hourly and daily weather forecast including temperatures, rain totals, PoP, and conditions."
        )
        from app.services.open_meteo import get_open_meteo_service
        self.open_meteo = get_open_meteo_service()

    async def execute(
        self,
        location: Optional[GeoLocation] = None,
        horizon_days: int = 3,
        context_override: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Fetch forecast from context or Open-Meteo live API only."""
        if context_override and len(context_override) > 0:
            return {
                "status": "success",
                "source_type": "backend_context",
                "horizon_days": len(context_override),
                "data": context_override[:horizon_days],
                "retrieved_at": datetime.utcnow().isoformat() + "Z",
            }

        if location and location.lat is not None and location.lon is not None:
            live_forecast = await self.open_meteo.get_forecast(location, days=horizon_days)
            if live_forecast:
                return {
                    "status": "success",
                    "source_type": "open_meteo_live_forecast",
                    "location": location.model_dump(),
                    "horizon_days": len(live_forecast),
                    "data": live_forecast,
                    "retrieved_at": datetime.utcnow().isoformat() + "Z",
                }
            return self.unavailable(
                reason="Live forecast unavailable from Open-Meteo.",
                location=location,
                source_type="open_meteo_error",
            )

        return self.unavailable(
            reason="Coordinates required for live forecast. Mock forecast data is not used.",
            location=location,
        )
