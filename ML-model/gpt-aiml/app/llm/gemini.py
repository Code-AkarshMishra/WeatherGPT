"""Gemini LLM Provider Adapter with retry, multi-key rotation, and live generation."""
import json
import re
import time
import warnings
from typing import Any, Dict, List, Optional
from app.core.config import get_settings
from app.core.logging import logger, mask_key
from app.llm.key_manager import GeminiKeyManager, get_key_manager
from app.llm.schemas import LLMGroundedAnswer

# Suppress SDK deprecation warnings for clean output
warnings.filterwarnings("ignore", category=FutureWarning)

try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False


class GeminiAdapter:
    """Enterprise-grade Gemini adapter with multi-key failover, exponential backoff, and mock fallback."""

    def __init__(self, key_manager: Optional[GeminiKeyManager] = None):
        self.settings = get_settings()
        self.key_manager = key_manager or get_key_manager()
        self.model_name = self.settings.GEMINI_MODEL
        self.timeout = self.settings.LLM_TIMEOUT_SECONDS
        self.max_retries = self.settings.LLM_MAX_RETRIES

    async def generate_grounded_response(
        self,
        system_prompt: str,
        user_prompt: str,
        context_data: Dict[str, Any],
        language: str = "en",
    ) -> LLMGroundedAnswer:
        """Generate grounded answer using live Gemini LLM with multi-key rotation and fallback."""
        if self.settings.MOCK_MODE or not self.key_manager.has_keys() or not GENAI_AVAILABLE:
            logger.info("Using grounded synthesis engine (MOCK_MODE=True or live keys not configured).")
            return self._generate_mock_grounded_response(user_prompt, context_data, language)

        prompt_payload = (
            f"You are WeatherGPT, an authoritative meteorological intelligence assistant.\n"
            f"System Instructions:\n{system_prompt}\n\n"
            f"Target Language: {language}\n"
            f"User Query: {user_prompt}\n\n"
            f"Verified Meteorological Data (JSON Context):\n{json.dumps(context_data, indent=2, default=str)}\n\n"
            "TASK: Answer the user query using ONLY the provided verified context in the requested target language.\n"
            "Respond STRICTLY with a valid JSON object matching this schema:\n"
            "```json\n"
            "{\n"
            '  "answer": "string (in target language)",\n'
            '  "confidence": 0.95,\n'
            '  "missing_data_notes": null,\n'
            '  "follow_up_questions": ["question 1 in target language", "question 2 in target language"],\n'
            '  "key_points": ["key takeaway 1", "key takeaway 2"],\n'
            '  "tts_friendly_text": "clean spoken text without markdown in target language"\n'
            "}\n"
            "```"
        )

        retries = 0
        last_error = None

        while retries <= self.max_retries:
            key = self.key_manager.get_active_key()
            if not key:
                break

            try:
                start_t = time.time()
                client = genai.Client(api_key=key)

                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt_payload,
                )

                raw_text = (response.text or "").strip()
                if not raw_text:
                    raise RuntimeError("Received empty response from Gemini.")

                latency = int((time.time() - start_t) * 1000)
                self.key_manager.record_success(key)
                logger.info(f"Gemini live call succeeded with key {mask_key(key)} in {latency}ms.")

                # Extract JSON block from markdown if present
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json", 1)[1].split("```", 1)[0].strip()
                elif "```" in raw_text:
                    raw_text = raw_text.split("```", 1)[1].split("```", 1)[0].strip()

                parsed = json.loads(raw_text)
                return LLMGroundedAnswer(**parsed)

            except Exception as e:
                err_str = str(e).lower()
                last_error = e
                logger.error(f"Gemini error with key {mask_key(key)}: {str(e)}")

                if any(w in err_str for w in ["429", "quota", "resourceexhausted", "rate_limit"]):
                    self.key_manager.record_rate_limit(key)
                else:
                    self.key_manager.record_failure(key)

                retries += 1
                time.sleep(0.5 * (2 ** retries))

        logger.warning(
            f"Live Gemini calls exhausted after {retries} retries ({last_error}). Falling back to grounded rule engine."
        )
        return self._generate_mock_grounded_response(user_prompt, context_data, language)

    def _generate_mock_grounded_response(
        self,
        user_prompt: str,
        context_data: Dict[str, Any],
        language: str = "en"
    ) -> LLMGroundedAnswer:
        """Deterministic synthesis using ONLY supplied live meteorological facts."""
        loc = context_data.get("location", {})
        loc_name = loc.get("name", "your area") if isinstance(loc, dict) else "your area"
        curr = context_data.get("current_weather") or {}
        alerts = context_data.get("alerts") or []
        risk = context_data.get("risk") or {}
        history = context_data.get("historical_baseline") or {}

        is_historical_query = bool(
            re.search(
                r"\b(19\d\d|200\d|201\d|202[0-5]|history|historical|past|purana|उस\s*साल|उस\s*दिन)\b",
                user_prompt,
                re.I,
            )
        )

        if is_historical_query:
            month_stats = None
            if isinstance(history, dict):
                if history.get("mean_temp") is not None:
                    month_stats = history
                else:
                    for key in (
                        "january", "february", "march", "april", "may", "june",
                        "july", "august", "september", "october", "november", "december",
                    ):
                        candidate = history.get(key)
                        if isinstance(candidate, dict) and candidate.get("mean_temp") is not None:
                            month_stats = candidate
                            break
            if not month_stats or month_stats.get("mean_temp") is None:
                answer_text = (
                    f"Historical weather data for {loc_name} is currently unavailable. "
                    "Hardcoded climatological normals are not used."
                )
                return LLMGroundedAnswer(
                    answer=answer_text,
                    confidence=0.3,
                    missing_data_notes="No live historical baseline was supplied.",
                    follow_up_questions=[f"What is the current weather in {loc_name}?"],
                    key_points=["Historical data unavailable"],
                    tts_friendly_text=answer_text,
                )
            mean_temp = month_stats.get("mean_temp")
            mean_rain = month_stats.get("mean_rainfall")
            parts = [f"Live historical context for {loc_name}:"]
            if mean_temp is not None:
                parts.append(f"mean temperature {mean_temp}°C")
            if mean_rain is not None:
                parts.append(f"mean rainfall {mean_rain} mm")
            answer_text = " ".join(parts) + "."
            return LLMGroundedAnswer(
                answer=answer_text,
                confidence=0.7,
                missing_data_notes="Values taken only from supplied historical context.",
                follow_up_questions=[f"How does current weather in {loc_name} compare?"],
                key_points=[p for p in parts[1:]],
                tts_friendly_text=answer_text.replace("°C", " degrees Celsius").replace("mm", " millimeters"),
            )

        temp = curr.get("temperature")
        condition = curr.get("condition")
        humidity = curr.get("humidity")
        rainfall_rate = curr.get("rainfall_rate")
        pop = curr.get("precipitation_probability")

        if temp is None and condition is None and humidity is None and rainfall_rate is None:
            answer_text = (
                f"Live weather data for {loc_name} is currently unavailable. "
                "WeatherGPT does not invent temperature, rainfall, or conditions."
            )
            return LLMGroundedAnswer(
                answer=answer_text,
                confidence=0.2,
                missing_data_notes="No live current_weather fields were supplied.",
                follow_up_questions=[f"Retry current weather for {loc_name}."],
                key_points=["Weather data unavailable"],
                tts_friendly_text=answer_text,
            )

        answer_parts = []
        if temp is not None:
            feels = curr.get("feels_like")
            feels_t = f" (feels like {feels}°C)" if feels is not None else ""
            cond_bit = f" and conditions are {condition}" if condition else ""
            answer_parts.append(f"In {loc_name}, the temperature is {temp}°C{feels_t}{cond_bit}.")
        elif condition:
            answer_parts.append(f"In {loc_name}, conditions are {condition}.")
        if rainfall_rate is not None and rainfall_rate > 0:
            pop_bit = f" (precipitation chance {pop}%)" if pop is not None else ""
            answer_parts.append(f"Rainfall rate is {rainfall_rate} mm/h{pop_bit}.")
        elif pop is not None and pop > 50:
            answer_parts.append(f"Precipitation probability is {pop}%.")
        if humidity is not None:
            answer_parts.append(f"Humidity is {humidity}%.")
        if alerts:
            answer_parts.append(f"Official alert in context: {alerts[0].get('headline') or alerts[0].get('title')}.")
        if risk.get("score") is not None:
            answer_parts.append(f"Risk score from live inputs: {risk.get('score')}/100 ({risk.get('level')}).")

        answer_text = " ".join(answer_parts)
        return LLMGroundedAnswer(
            answer=answer_text,
            confidence=0.75,
            missing_data_notes="Synthesized only from supplied live context fields.",
            follow_up_questions=[
                f"What is the forecast for {loc_name}?",
                f"Are there any official warnings for {loc_name}?",
            ],
            key_points=[p for p in answer_parts[:3]],
            tts_friendly_text=answer_text.replace("°C", " degrees Celsius").replace("mm/h", " millimeters per hour"),
        )


_gemini_adapter_instance: Optional[GeminiAdapter] = None


def get_gemini_adapter() -> GeminiAdapter:
    """Singleton provider for GeminiAdapter."""
    global _gemini_adapter_instance
    if _gemini_adapter_instance is None:
        _gemini_adapter_instance = GeminiAdapter()
    return _gemini_adapter_instance
