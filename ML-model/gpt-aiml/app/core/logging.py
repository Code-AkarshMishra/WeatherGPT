"""Structured logging with secret masking for WeatherGPT AI/ML."""
import logging
import re
import sys
from typing import Any

# Pattern to identify potential API keys / secrets for masking
KEY_PATTERN = re.compile(r'(AIzaSy[A-Za-z0-9_-]{33}|[a-zA-Z0-9_\-]{32,})')


class MaskingFormatter(logging.Formatter):
    """Custom formatter to mask sensitive credentials and keys."""

    def format(self, record: logging.LogRecord) -> str:
        msg = super().format(record)
        return self._mask_secrets(msg)

    @staticmethod
    def _mask_secrets(text: str) -> str:
        def _repl(match: re.Match) -> str:
            val = match.group(0)
            if len(val) <= 8:
                return "******"
            return f"{val[:4]}...{val[-4:]}"

        return KEY_PATTERN.sub(_repl, text)


def mask_key(key: str) -> str:
    """Helper to safely format a key for debugging."""
    if not key:
        return "None"
    if len(key) <= 8:
        return "***"
    return f"key_***{key[-4:]}"


def setup_logger(name: str = "weathergpt", log_level: str = "INFO") -> logging.Logger:
    """Initialize and configure logger with secret masking."""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        formatter = MaskingFormatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logger()
