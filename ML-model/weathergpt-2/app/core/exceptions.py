class WeatherGPTError(Exception):
    """Base app error."""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class GeminiUnavailableError(WeatherGPTError):
    def __init__(self, message: str = "Weather AI is temporarily unavailable. Please try again."):
        super().__init__(message=message, status_code=503)