"""Open-Meteo API Client for Live, Forecast, and Historical Weather Data."""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import get_settings
from app.schemas.common import GeoLocation

logger = logging.getLogger("weathergpt.open_meteo")

WMO_CODE_MAP = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    56: "Light Freezing Drizzle",
    57: "Dense Freezing Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    66: "Light Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Slight Snow Fall",
    73: "Moderate Snow Fall",
    75: "Heavy Snow Fall",
    77: "Snow Grains",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    85: "Slight Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Slight Hail",
    99: "Thunderstorm with Heavy Hail",
}


class OpenMeteoService:
    """Async client for Open-Meteo Meteorological API."""

    def __init__(self):
        self.settings = get_settings()
        self.base_url = self.settings.OPEN_METEO_BASE_URL.rstrip("/")
        self.archive_url = self.settings.OPEN_METEO_HISTORICAL_URL.rstrip("/")
        
        # Handle if user pasted a full URL or a commercial key into OPEN_METEO_API_KEY
        raw_key = (self.settings.OPEN_METEO_API_KEY or "").strip()
        if raw_key.startswith("http://") or raw_key.startswith("https://"):
            self.api_key = None
            self.direct_url = raw_key
        else:
            self.api_key = raw_key if raw_key else None
            self.direct_url = None

    def _get_auth_params(self) -> Dict[str, str]:
        """Return API key query params only if a commercial key is configured (not URL)."""
        if self.api_key and self.api_key.strip():
            return {"apikey": self.api_key.strip()}
        return {}

    async def get_current_weather(self, location: GeoLocation) -> Optional[Dict[str, Any]]:
        """Fetch live verified current weather from Open-Meteo."""
        if not location or location.lat is None or location.lon is None:
            logger.warning("Open-Meteo current weather skipped: coordinates required.")
            return None
        lat = location.lat
        lon = location.lon

        url = f"{self.base_url}/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure",
            "timezone": "auto",
            **self._get_auth_params(),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    payload = res.json()
                    curr = payload.get("current", {})
                    weather_code = curr.get("weather_code")
                    condition_text = (
                        WMO_CODE_MAP.get(weather_code) if weather_code is not None else None
                    )
                    
                    return {
                        "temperature": curr.get("temperature_2m"),
                        "feels_like": curr.get("apparent_temperature"),
                        "humidity": curr.get("relative_humidity_2m"),
                        "rainfall_rate": curr.get("precipitation"),
                        "wind_speed": curr.get("wind_speed_10m"),
                        "wind_direction": (
                            f"{curr.get('wind_direction_10m')}°"
                            if curr.get("wind_direction_10m") is not None
                            else None
                        ),
                        "pressure": curr.get("surface_pressure"),
                        "condition": condition_text,
                        "source": "Open-Meteo High-Resolution NWP Observation",
                        "recorded_at": curr.get("time", datetime.utcnow().isoformat()),
                    }
                else:
                    logger.warning(f"Open-Meteo current weather returned {res.status_code}: {res.text}")
        except Exception as exc:
            logger.error(f"Error fetching Open-Meteo live weather: {exc}")

        return None

    async def get_forecast(self, location: GeoLocation, days: int = 3) -> Optional[List[Dict[str, Any]]]:
        """Fetch live verified 3-7 day forecast from Open-Meteo."""
        if not location or location.lat is None or location.lon is None:
            logger.warning("Open-Meteo forecast skipped: coordinates required.")
            return None
        lat = location.lat
        lon = location.lon

        url = f"{self.base_url}/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code",
            "forecast_days": min(days, 7),
            "timezone": "auto",
            **self._get_auth_params(),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    payload = res.json()
                    daily = payload.get("daily", {})
                    dates = daily.get("time", [])
                    t_max = daily.get("temperature_2m_max", [])
                    t_min = daily.get("temperature_2m_min", [])
                    precip = daily.get("precipitation_sum", [])
                    pop = daily.get("precipitation_probability_max", [])
                    w_codes = daily.get("weather_code", [])

                    forecast_list = []
                    for idx, d_str in enumerate(dates):
                        code = w_codes[idx] if idx < len(w_codes) else 0
                        forecast_list.append({
                            "date": d_str,
                            "temp_max": t_max[idx] if idx < len(t_max) else None,
                            "temp_min": t_min[idx] if idx < len(t_min) else None,
                            "rainfall_total": precip[idx] if idx < len(precip) else 0.0,
                            "precipitation_probability": pop[idx] if idx < len(pop) else 0,
                            "condition": WMO_CODE_MAP.get(code, "Clear Sky"),
                            "source": "Open-Meteo Global Ensemble Forecast",
                        })
                    return forecast_list
                else:
                    logger.warning(f"Open-Meteo forecast returned {res.status_code}: {res.text}")
        except Exception as exc:
            logger.error(f"Error fetching Open-Meteo forecast: {exc}")

        return None

    async def get_historical_archive(
        self,
        location: GeoLocation,
        start_date: str,
        end_date: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Fetch real historical meteorological archive for specific past dates."""
        lat = location.lat if (location and location.lat is not None) else None
        lon = location.lon if (location and location.lon is not None) else None
        if lat is None or lon is None:
            logger.warning("Open-Meteo historical archive skipped: coordinates required.")
            return None
        end = end_date or start_date

        # Determine best historical endpoint:
        # If user configured OPEN_METEO_HISTORICAL_URL with custom URL, use that base, else select archive-api vs historical-forecast-api
        raw_hist = (self.settings.OPEN_METEO_HISTORICAL_URL or "").split("?")[0].rstrip("/")
        if "historical-forecast-api" in raw_hist:
            url = f"{raw_hist}/forecast" if not raw_hist.endswith("/forecast") else raw_hist
        elif "archive-api" in raw_hist:
            url = f"{raw_hist}/archive" if not raw_hist.endswith("/archive") else raw_hist
        else:
            # Standard auto-selection
            url = "https://archive-api.open-meteo.com/v1/archive"

        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end,
            "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,weather_code",
            "timezone": "auto",
            **self._get_auth_params(),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    payload = res.json()
                    daily = payload.get("daily", {})
                    t_mean = daily.get("temperature_2m_mean", [None])[0]
                    t_max = daily.get("temperature_2m_max", [None])[0]
                    t_min = daily.get("temperature_2m_min", [None])[0]
                    precip = daily.get("precipitation_sum", [None])[0]
                    wind = daily.get("wind_speed_10m_max", [None])[0]
                    w_code = daily.get("weather_code", [0])[0]

                    return {
                        "date": start_date,
                        "mean_temp": t_mean,
                        "record_max_temp": t_max,
                        "record_min_temp": t_min,
                        "recorded_rainfall_mm": precip,
                        "max_wind_speed_kmh": wind,
                        "condition": WMO_CODE_MAP.get(w_code, "Recorded Observation"),
                        "source": "Open-Meteo Global Reanalysis Archive",
                    }
                else:
                    logger.warning(f"Open-Meteo historical archive returned {res.status_code}: {res.text}")
        except Exception as exc:
            logger.error(f"Error fetching Open-Meteo archive: {exc}")

        return None


_open_meteo_service: Optional[OpenMeteoService] = None


def get_open_meteo_service() -> OpenMeteoService:
    """Singleton getter for OpenMeteoService."""
    global _open_meteo_service
    if _open_meteo_service is None:
        _open_meteo_service = OpenMeteoService()
    return _open_meteo_service
