"""Climate statistical analysis — live data only; no invented normals."""
from app.schemas.climate import (
    ClimateMetric,
    ClimateTrendRequest,
    ClimateTrendResponse,
    TrendDirection,
)
from app.tools.climate import ClimateTrendTool


class ClimateService:
    """Service for climate statistics when a live archive analysis is available."""

    def __init__(self):
        self.climate_tool = ClimateTrendTool()

    async def analyze_climate(self, request: ClimateTrendRequest) -> ClimateTrendResponse:
        c_res = await self.climate_tool.execute(
            location=request.location,
            metric=request.metric.value,
        )
        loc_name = (
            (request.location.name if request.location else None)
            or (c_res.get("location") or {}).get("name")
            or "Unknown location"
        )
        return ClimateTrendResponse(
            location_name=loc_name,
            metric=request.metric,
            period="unavailable",
            trend_direction=TrendDirection.VARIABLE,
            rate_of_change="unavailable",
            statistical_significance_p_value=None,
            historical_mean=None,
            historical_min=None,
            historical_max=None,
            annual_summary={},
            summary_narrative=(
                c_res.get("error")
                or "Climate statistics unavailable. Hardcoded normals and trends are not used."
            ),
            source_notes="climate: unavailable_without_live_archive",
        )
