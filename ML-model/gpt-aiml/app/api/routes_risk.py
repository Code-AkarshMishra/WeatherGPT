"""Risk evaluation endpoints."""
from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from app.core.security import verify_internal_secret
from app.schemas.risk import RiskScoreRequest, RiskScoreResponse
from app.services.risk_service import RiskService

router = APIRouter(prefix="/risk", tags=["Meteorological Risk Engine"])
_risk_service = RiskService()


@router.post(
    "/score",
    response_model=RiskScoreResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute deterministic multi-hazard risk score and factor breakdown",
    dependencies=[Depends(verify_internal_secret)],
)
async def compute_risk_score(request: RiskScoreRequest) -> RiskScoreResponse:
    """Evaluate meteorological risk for a hazard and location context."""
    return await _risk_service.calculate_risk(request)


@router.post(
    "/explain",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Generate human-readable risk explanation",
    dependencies=[Depends(verify_internal_secret)],
)
async def explain_risk_score(request: RiskScoreRequest) -> Dict[str, Any]:
    """Compute risk score and return detailed explanatory breakdown."""
    risk_response = await _risk_service.calculate_risk(request)
    return await _risk_service.explain_risk(risk_response)
