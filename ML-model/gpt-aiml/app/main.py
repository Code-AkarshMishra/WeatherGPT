"""WeatherGPT AI/ML Intelligence Service FastAPI Main Application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes_advisory import router as advisory_router
from app.api.routes_anomaly import router as anomaly_router
from app.api.routes_chat import router as chat_router
from app.api.routes_climate import router as climate_router
from app.api.routes_health import router as health_router
from app.api.routes_risk import router as risk_router
from app.core.config import get_settings
from app.core.logging import logger, mask_key
from app.llm.key_manager import get_key_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycles."""
    settings = get_settings()
    key_mgr = get_key_manager()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} (Env: {settings.APP_ENV})")
    logger.info(f"Mock Mode: {settings.MOCK_MODE} | Registered Gemini Keys: {key_mgr.total_keys}")
    yield
    logger.info("Shutting down WeatherGPT AI/ML Intelligence Service.")


def create_app() -> FastAPI:
    """Factory creating and configuring the FastAPI app instance."""
    settings = get_settings()

    app = FastAPI(
        title="WeatherGPT — AI/ML Intelligence Service",
        description="Grounded meteorological intelligence layer for SIH PS 26068 (FastAPI, LLM orchestration, Multi-hazard risk engine, Anomaly detection, Multilingual English + Hindi).",
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS configuration (Trust boundary: Node.js backend)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handler for unhandled errors
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled error processing {request.method} {request.url.path}: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal meteorological intelligence service error",
                "detail": str(exc) if settings.APP_ENV != "production" else "Please contact support",
                "path": request.url.path,
            },
        )

    # Register API Routers under /api/v1
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(risk_router, prefix="/api/v1")
    app.include_router(advisory_router, prefix="/api/v1")
    app.include_router(climate_router, prefix="/api/v1")
    app.include_router(anomaly_router, prefix="/api/v1")

    return app


app = create_app()
