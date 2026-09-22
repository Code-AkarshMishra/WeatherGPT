"""Climate trend endpoints."""
from fastapi import APIRouter, Depends, status
from app.core.security import verify_internal_secret
from app.schemas.climate import ClimateTrendRequest, ClimateTrendResponse
from app.services.climate_service import ClimateService

router = APIRouter(prefix="/climate", tags=["Climate Analytics"])
_climate_service = ClimateService()


@router.post(
    "/analyze",
    response_model=ClimateTrendResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze long-term climatological trends and historical statistics",
    dependencies=[Depends(verify_internal_secret)],
)
async def analyze_climate_trend(request: ClimateTrendRequest) -> ClimateTrendResponse:
    """Analyze multi-decadal temperature, rainfall, or monsoon trends."""
    return await _climate_service.analyze_climate(request)
