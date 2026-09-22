"""Configuration management for WeatherGPT AI/ML service."""
import os
from functools import lru_cache
from typing import List, Optional

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    USE_PYDANTIC_SETTINGS = True
except ImportError:
    from pydantic import BaseModel as BaseSettings
    SettingsConfigDict = dict
    USE_PYDANTIC_SETTINGS = False


class Settings(BaseSettings):
    APP_NAME: str = "WeatherGPT-AI"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    MOCK_MODE: bool = os.getenv("MOCK_MODE", "false").lower() in ("true", "1", "yes")

    # Gemini LLM Credentials & Rotation
    GEMINI_API_KEY_1: Optional[str] = os.getenv("GEMINI_API_KEY_1")
    GEMINI_API_KEY_2: Optional[str] = os.getenv("GEMINI_API_KEY_2")
    GEMINI_API_KEY_3: Optional[str] = os.getenv("GEMINI_API_KEY_3")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    LLM_TIMEOUT_SECONDS: int = int(os.getenv("LLM_TIMEOUT_SECONDS", "20"))
    LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "2"))

    # Backend Trust Boundary & Internal Integration
    BACKEND_INTERNAL_URL: str = os.getenv("BACKEND_INTERNAL_URL", "http://localhost:5000")
    INTERNAL_API_SECRET: Optional[str] = os.getenv("INTERNAL_API_SECRET")

    # Open-Meteo Weather API Integration
    OPEN_METEO_API_KEY: Optional[str] = os.getenv("OPEN_METEO_API_KEY")
    OPEN_METEO_BASE_URL: str = os.getenv("OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1")
    OPEN_METEO_HISTORICAL_URL: str = os.getenv("OPEN_METEO_HISTORICAL_URL", "https://archive-api.open-meteo.com/v1")

    # Paths
    MODEL_DIR: str = os.getenv("MODEL_DIR", "./models")
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")

    if USE_PYDANTIC_SETTINGS:
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
        )

    @property
    def gemini_api_keys(self) -> List[str]:
        """Return list of valid, non-empty Gemini API keys."""
        keys = []
        for k in [self.GEMINI_API_KEY_1, self.GEMINI_API_KEY_2, self.GEMINI_API_KEY_3]:
            if k and k.strip():
                keys.append(k.strip())
        return keys


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
