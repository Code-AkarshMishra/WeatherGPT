"""Official warning alert tool."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from app.schemas.common import GeoLocation
from app.tools.base import BaseWeatherTool


class AlertsTool(BaseWeatherTool):
    """Retrieves official warnings only from backend context — never from mock JSON."""

    def __init__(self):
        super().__init__(
            name="get_alerts",
            description="Retrieve official meteorological warnings when supplied by the backend."
        )

    async def execute(
        self,
        location: Optional[GeoLocation] = None,
        active_only: bool = True,
        context_override: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        if context_override is not None:
            return {
                "status": "success",
                "source_type": "backend_context",
                "active_alerts_count": len(context_override),
                "data": context_override,
                "retrieved_at": datetime.utcnow().isoformat() + "Z",
            }

        return {
            "status": "error",
            "available": False,
            "source_type": "unavailable",
            "location": {"name": location.name if location else None},
            "active_alerts_count": 0,
            "data": [],
            "error": (
                "No official warning feed is configured for this request. "
                "Mock IMD alerts are not used. Pass context_override / alert_context "
                "when a real warning source is available."
            ),
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }
