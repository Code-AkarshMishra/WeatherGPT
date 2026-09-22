from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.chat import router as chat_router
from app.api.historical import router as historical_router
from app.api.intelligence import router as intelligence_router
from app.api.nwp import router as nwp_router
from app.core.exceptions import WeatherGPTError
from app.models.errors import ErrorResponse

app = FastAPI(
    title="WeatherGPT AI Service",
    description="Conversational weather AI service for SIH 2026 (MERN-integrated FastAPI)",
    version="0.2.0",
)

# Allow MERN frontend (and local dev) to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Unprefixed routes (direct clients / docs examples)
app.include_router(chat_router)
app.include_router(intelligence_router)
app.include_router(nwp_router)
app.include_router(historical_router)

# /api/v1 aliases for MERN backend (ai.service.js) compatibility
app.include_router(chat_router, prefix="/api/v1")
app.include_router(intelligence_router, prefix="/api/v1")
app.include_router(nwp_router, prefix="/api/v1")
app.include_router(historical_router, prefix="/api/v1")


@app.exception_handler(WeatherGPTError)
async def weathergpt_error_handler(request: Request, exc: WeatherGPTError):
    body = ErrorResponse(status="error", error=exc.message)
    return JSONResponse(status_code=exc.status_code, content=body.model_dump())


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    body = ErrorResponse(
        status="error",
        error="Invalid request. Check message/location fields.",
        detail=exc.errors(),
    )
    return JSONResponse(status_code=422, content=body.model_dump())


@app.get("/")
def root():
    return {
        "message": "WeatherGPT AI service is running",
        "status": "ok",
        "docs": "/docs",
        "chat": "POST /chat (also POST /api/v1/chat)",
        "intelligence": [
            "POST /risk/score",
            "POST /advisory",
            "POST /anomaly/detect",
            "POST /climate/analyze",
            "POST /nwp/hazard-assessment",
            "POST /climate/historical-analysis",
            "POST /climate/nwp-verification",
            "GET /model-info",
            "All of the above also under /api/v1/* for MERN backend",
        ],
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "weathergpt-ai",
        "version": "0.2.0",
        "engines": ["chat", "risk", "advisory", "anomaly", "climate", "nwp_hazard", "historical_analysis"],
    }
