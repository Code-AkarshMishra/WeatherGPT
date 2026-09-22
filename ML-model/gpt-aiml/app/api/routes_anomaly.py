"""Anomaly detection endpoints."""
from fastapi import APIRouter, Depends, status
from app.core.security import verify_internal_secret
from app.schemas.anomaly import AnomalyDetectRequest, AnomalyDetectResponse
from app.services.anomaly_service import AnomalyService

router = APIRouter(prefix="/anomaly", tags=["Meteorological Anomaly Detection"])
_anomaly_service = AnomalyService()


@router.post(
    "/detect",
    response_model=AnomalyDetectResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect meteorological departures against 30-year climatological normals",
    dependencies=[Depends(verify_internal_secret)],
)
async def detect_weather_anomalies(request: AnomalyDetectRequest) -> AnomalyDetectResponse:
    """Evaluate temperature, rainfall, or wind departures from historical normals."""
    return await _anomaly_service.detect_anomalies(request)
