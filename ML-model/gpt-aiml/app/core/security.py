"""Internal API security and validation."""
from typing import Optional
from fastapi import Header, HTTPException, status
from app.core.config import get_settings


async def verify_internal_secret(x_internal_secret: Optional[str] = Header(None)) -> bool:
    """Validate internal communication secret between Node.js backend and AI service.
    
    Allows open access in development/test mode for Swagger UI and local development.
    Strictly enforced when secret is configured and running in production.
    """
    settings = get_settings()
    
    # If no secret configured or in local development/test mode without header, allow
    if not settings.INTERNAL_API_SECRET or settings.APP_ENV in ("development", "test"):
        if not x_internal_secret:
            return True

    if x_internal_secret != settings.INTERNAL_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal service secret.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True
