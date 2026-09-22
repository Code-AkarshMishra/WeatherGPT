"""Gemini API Key Manager with rotation, cooldown tracking, and masked logging."""
import time
from typing import Any, Dict, List, Optional
from app.core.config import get_settings
from app.core.logging import logger, mask_key


class GeminiKeyManager:
    """Manages pool of Gemini API keys with automatic rotation and error-cooldown."""

    def __init__(self, keys: Optional[List[str]] = None, cooldown_seconds: int = 300):
        if keys is None:
            settings = get_settings()
            keys = settings.gemini_api_keys

        self.keys: List[str] = [k.strip() for k in keys if k and k.strip()]
        self.cooldown_seconds: int = cooldown_seconds
        self._current_idx: int = 0
        self._key_cooldowns: Dict[str, float] = {}  # key -> cooldown_expiry_timestamp
        self._key_stats: Dict[str, Dict[str, int]] = {
            k: {"success": 0, "failures": 0, "rate_limits": 0} for k in self.keys
        }

        logger.info(f"Initialized GeminiKeyManager with {len(self.keys)} active API keys.")

    @property
    def total_keys(self) -> int:
        return len(self.keys)

    def has_keys(self) -> bool:
        return len(self.keys) > 0

    def get_active_key(self) -> Optional[str]:
        """Return the next available healthy key, skipping keys in cooldown."""
        if not self.keys:
            return None

        now = time.time()
        start_idx = self._current_idx

        for i in range(len(self.keys)):
            idx = (start_idx + i) % len(self.keys)
            key = self.keys[idx]
            cooldown_until = self._key_cooldowns.get(key, 0)

            if now >= cooldown_until:
                self._current_idx = (idx + 1) % len(self.keys)
                return key

        # If all keys are in cooldown, pick the one that expires earliest
        earliest_key = min(self.keys, key=lambda k: self._key_cooldowns.get(k, 0))
        logger.warning(
            f"All Gemini keys currently in cooldown. Using earliest expiring key: {mask_key(earliest_key)}"
        )
        return earliest_key

    def record_success(self, key: str):
        """Record successful call for this key."""
        if key in self._key_stats:
            self._key_stats[key]["success"] += 1

    def record_rate_limit(self, key: str, custom_cooldown: Optional[int] = None):
        """Mark a key as rate-limited / quota exhausted and put into cooldown."""
        cooldown = custom_cooldown or self.cooldown_seconds
        self._key_cooldowns[key] = time.time() + cooldown
        if key in self._key_stats:
            self._key_stats[key]["rate_limits"] += 1
        logger.warning(
            f"Gemini key {mask_key(key)} marked rate-limited. Placed in cooldown for {cooldown}s."
        )

    def record_failure(self, key: str):
        """Record general provider failure."""
        if key in self._key_stats:
            self._key_stats[key]["failures"] += 1

    def get_status_report(self) -> List[Dict[str, Any]]:
        """Return sanitized status report for health monitoring."""
        now = time.time()
        report = []
        for i, key in enumerate(self.keys):
            cooldown_remaining = max(0, int(self._key_cooldowns.get(key, 0) - now))
            report.append({
                "key_slot": f"GEMINI_API_KEY_{i+1}",
                "masked_key": mask_key(key),
                "is_healthy": cooldown_remaining == 0,
                "cooldown_remaining_sec": cooldown_remaining,
                "stats": self._key_stats.get(key, {}),
            })
        return report


_key_manager_instance: Optional[GeminiKeyManager] = None


def get_key_manager() -> GeminiKeyManager:
    """Singleton provider for GeminiKeyManager."""
    global _key_manager_instance
    if _key_manager_instance is None:
        _key_manager_instance = GeminiKeyManager()
    return _key_manager_instance
