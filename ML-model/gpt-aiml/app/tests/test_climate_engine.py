"""Unit tests for climate trend service."""
import pytest
from app.schemas.climate import ClimateMetric, ClimateTrendRequest
from app.schemas.common import GeoLocation
from app.services.climate_service import ClimateService


@pytest.mark.asyncio
async def test_climate_trend_temperature():
    service = ClimateService()
    req = ClimateTrendRequest(
        location=GeoLocation(name="Lucknow"),
        metric=ClimateMetric.TEMPERATURE,
        period_years=35,
    )
    res = await service.analyze_climate(req)
    assert res.metric == ClimateMetric.TEMPERATURE
    assert "decade" in res.rate_of_change.lower()
    assert res.historical_mean > 0
    assert len(res.summary_narrative) > 20
