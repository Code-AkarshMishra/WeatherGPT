"""Climate trend intelligence tool."""
from typing import Any, Dict, Optional
from app.schemas.common import GeoLocation
from app.tools.base import BaseWeatherTool


class ClimateTrendTool(BaseWeatherTool):
    """Climate trends require a live multi-year archive analysis — not mock JSON."""

    def __init__(self):
        super().__init__(
            name="get_climate_trend",
            description="Retrieve long-term climate statistics when a live archive service is available."
        )

    async def execute(
        self,
        location: Optional[GeoLocation] = None,
        metric: str = "temperature",
        **kwargs
    ) -> Dict[str, Any]:
        return self.unavailable(
            reason=(
                "Multi-decadal climate trends are not available from mock station JSON. "
                "Use the weathergpt-2 historical/climate analysis APIs (ERA5) or an official "
                "climate database. Values were not fabricated."
            ),
            location=location,
            metric=metric,
            source_type="climate_unavailable",
        )
