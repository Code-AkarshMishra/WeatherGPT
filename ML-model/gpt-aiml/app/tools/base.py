"""Base interface for WeatherGPT meteorological tools.

Runtime tools must use live APIs. mock_baselines.json is not loaded.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from app.core.config import get_settings
from app.schemas.common import GeoLocation


class BaseWeatherTool(ABC):
    """Abstract base class for all meteorological data and intelligence tools."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.settings = get_settings()

    def unavailable(
        self,
        *,
        reason: str,
        location: Optional[GeoLocation] = None,
        source_type: str = "unavailable",
        **extra: Any,
    ) -> Dict[str, Any]:
        """Structured failure — never substitute fabricated weather."""
        payload: Dict[str, Any] = {
            "status": "error",
            "available": False,
            "source_type": source_type,
            "error": reason,
            "location": location.model_dump() if location else {},
        }
        payload.update(extra)
        return payload

    @abstractmethod
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute tool and return structured payload."""
        pass
