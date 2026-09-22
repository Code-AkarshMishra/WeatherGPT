"""Historical meteorological retrieval tool."""
from datetime import datetime
from typing import Any, Dict, Optional
from app.schemas.common import GeoLocation
from app.tools.base import BaseWeatherTool


class HistoricalWeatherTool(BaseWeatherTool):
    """Retrieves historical weather from the Open-Meteo archive only."""

    def __init__(self):
        super().__init__(
            name="get_historical_weather",
            description="Retrieve historical weather for a past date from the Open-Meteo archive."
        )
        from app.services.open_meteo import get_open_meteo_service
        self.open_meteo = get_open_meteo_service()

    async def execute(
        self,
        location: Optional[GeoLocation] = None,
        month: Optional[str] = None,
        date: Optional[str] = None,
        year: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Fetch historical archive data. Does not invent climatological normals."""
        month = month or datetime.utcnow().strftime("%B").lower()
        if date and location and location.lat is not None and location.lon is not None:
            archive_res = await self.open_meteo.get_historical_archive(location, start_date=date)
            if archive_res:
                return {
                    "status": "success",
                    "source_type": "open_meteo_historical_archive",
                    "location": {
                        "name": location.name or "Station",
                        "lat": location.lat,
                        "lon": location.lon,
                    },
                    "date": date,
                    "month": month,
                    "data": archive_res,
                    "retrieved_at": datetime.utcnow().isoformat() + "Z",
                }
            return self.unavailable(
                reason="Historical archive unavailable from Open-Meteo for the requested date.",
                location=location,
                source_type="open_meteo_error",
                date=date,
            )

        return self.unavailable(
            reason=(
                "Historical weather requires coordinates and a past date. "
                "Demo climatological normals from mock_baselines.json are not used."
            ),
            location=location,
            month=month,
        )
