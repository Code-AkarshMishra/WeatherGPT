"""Advisory tool wrapper."""
from typing import Any, Dict, List, Optional
from app.schemas.advisory import AdvisoryDomain, AdvisoryRequest, AdvisoryResponse
from app.schemas.common import GeoLocation
from app.tools.base import BaseWeatherTool


class AdvisoryTool(BaseWeatherTool):
    """Generates actionable decision-support advisories for specialized domains."""

    def __init__(self):
        super().__init__(
            name="get_advisory",
            description="Generate domain-specific recommendations (agriculture, travel, disaster, urban_general)."
        )
        self._service = None

    def _get_service(self):
        if self._service is None:
            from app.services.advisory_service import AdvisoryService
            self._service = AdvisoryService()
        return self._service

    async def execute(
        self,
        domain: AdvisoryDomain = AdvisoryDomain.URBAN_GENERAL,
        location: Optional[GeoLocation] = None,
        weather_context: Optional[Dict[str, Any]] = None,
        forecast_context: Optional[List[Dict[str, Any]]] = None,
        alert_context: Optional[List[Dict[str, Any]]] = None,
        user_context: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Execute advisory generation."""
        service = self._get_service()
        req = AdvisoryRequest(
            location=location,
            domain=domain,
            weather_context=weather_context,
            forecast_context=forecast_context,
            alert_context=alert_context,
            user_context=user_context,
        )
        res: AdvisoryResponse = await service.generate_advisory(req)
        return {
            "status": "success",
            "advisory": res.model_dump(),
        }
