"""API routers package."""
from app.api.routes_advisory import router as advisory_router
from app.api.routes_anomaly import router as anomaly_router
from app.api.routes_chat import router as chat_router
from app.api.routes_climate import router as climate_router
from app.api.routes_health import router as health_router
from app.api.routes_risk import router as risk_router

__all__ = [
    "health_router",
    "chat_router",
    "risk_router",
    "advisory_router",
    "climate_router",
    "anomaly_router",
]
