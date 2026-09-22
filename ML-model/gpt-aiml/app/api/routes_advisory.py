"""Advisory endpoints."""
from fastapi import APIRouter, Depends, status
from app.core.security import verify_internal_secret
from app.schemas.advisory import AdvisoryRequest, AdvisoryResponse
from app.services.advisory_service import AdvisoryService

router = APIRouter(prefix="/advisory", tags=["Domain Advisory Engine"])
_advisory_service = AdvisoryService()


@router.post(
    "",
    response_model=AdvisoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate domain-specific weather decision support advisory",
    dependencies=[Depends(verify_internal_secret)],
)
async def generate_advisory_endpoint(request: AdvisoryRequest) -> AdvisoryResponse:
    """Generate advisory guidance for agriculture, travel, disaster, or urban daily life."""
    return await _advisory_service.generate_advisory(request)
