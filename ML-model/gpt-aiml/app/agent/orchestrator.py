"""Agent Orchestrator coordinating Intent, Entities, Tools, LLM synthesis, and Grounding."""
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from app.agent.entities import EntityExtractor, ExtractedEntities
from app.agent.intent import IntentClassifier, UserIntent
from app.agent.prompts import get_system_prompt
from app.agent.router import ToolRouter
from app.core.logging import logger
from app.llm.gemini import GeminiAdapter, get_gemini_adapter
from app.schemas.advisory import AdvisoryResponse
from app.schemas.chat import ChatRequest, ChatResponse, CitationSource
from app.schemas.common import GeoLocation
from app.schemas.risk import HazardType, RiskScoreResponse
from app.tools.advisory import AdvisoryTool
from app.tools.alerts import AlertsTool
from app.tools.climate import ClimateTrendTool
from app.tools.forecast import ForecastTool
from app.tools.historical import HistoricalWeatherTool
from app.tools.risk import RiskScoreTool
from app.tools.weather import CurrentWeatherTool


class AgentOrchestrator:
    """Core intelligence orchestrator for WeatherGPT."""

    def __init__(self, gemini_adapter: Optional[GeminiAdapter] = None):
        self.llm_adapter = gemini_adapter or get_gemini_adapter()
        self.weather_tool = CurrentWeatherTool()
        self.forecast_tool = ForecastTool()
        self.alerts_tool = AlertsTool()
        self.historical_tool = HistoricalWeatherTool()
        self.climate_tool = ClimateTrendTool()
        self.risk_tool = RiskScoreTool()
        self.advisory_tool = AdvisoryTool()

    async def process_chat(self, request: ChatRequest) -> ChatResponse:
        """Execute grounded conversation pipeline."""
        start_time = time.time()
        prompt = request.get_prompt()

        # 1. Intent & Entity Extraction
        intent = IntentClassifier.classify(prompt)
        entities = EntityExtractor.extract(
            text=prompt,
            supplied_location=request.location,
            supplied_language=request.language,
        )
        target_lang = entities.language
        location = entities.location

        logger.info(f"Detected Intent: {intent.value} | Location: {location.name if location else 'None'} | Lang: {target_lang}")

        # 2. Tool Routing
        tools_to_run = ToolRouter.select_tools(intent, entities)
        tool_audit_trail: List[str] = []
        collected_context: Dict[str, Any] = {
            "location": location.model_dump() if location else {},
            "query_time": datetime.utcnow().isoformat() + "Z",
        }
        citations: List[CitationSource] = []
        risk_output: Optional[RiskScoreResponse] = None
        advisory_output: Optional[AdvisoryResponse] = None

        # Pre-populate with backend provided context if present
        backend_weather = request.weather_context or (request.context.current_weather if request.context else None)
        backend_forecast = request.forecast_context or (request.context.forecast if request.context else None)
        backend_alerts = request.alert_context or (request.context.alerts if request.context else None)
        backend_history = request.history_context or (request.context.history if request.context else None)

        # 3. Execute Tools
        if "get_current_weather" in tools_to_run:
            w_res = await self.weather_tool.execute(
                location=location,
                context_override=backend_weather,
            )
            collected_context["current_weather"] = w_res.get("data", {})
            tool_audit_trail.append("get_current_weather")
            citations.append(
                CitationSource(
                    title="Surface Meteorological Station",
                    provider=str(w_res.get("data", {}).get("source", "IMD Observation Network")),
                    station_or_model=location.name or "Primary Station",
                    timestamp=w_res.get("retrieved_at", ""),
                    data_points=["temperature", "humidity", "wind_speed", "rainfall_rate"],
                )
            )

        if "get_forecast" in tools_to_run:
            f_res = await self.forecast_tool.execute(
                location=location,
                context_override=backend_forecast,
            )
            collected_context["forecast"] = f_res.get("data", [])
            tool_audit_trail.append("get_forecast")
            citations.append(
                CitationSource(
                    title="Numerical Weather Prediction",
                    provider="IMD-WRF / GFS Forecast Model",
                    station_or_model="High-Resolution Multi-Model Ensemble",
                    timestamp=f_res.get("retrieved_at", ""),
                    data_points=["precipitation_probability", "rainfall_total", "temp_max", "temp_min"],
                )
            )

        if "get_alerts" in tools_to_run:
            a_res = await self.alerts_tool.execute(
                location=location,
                context_override=backend_alerts,
            )
            collected_context["alerts"] = a_res.get("data", [])
            tool_audit_trail.append("get_alerts")
            if a_res.get("data"):
                citations.append(
                    CitationSource(
                        title="Official Government Alerts",
                        provider="India Meteorological Department (IMD)",
                        station_or_model="National Warning Bulletin",
                        timestamp=a_res.get("retrieved_at", ""),
                        data_points=["hazard", "severity", "headline", "instruction"],
                    )
                )

        if "get_historical_weather" in tools_to_run:
            h_res = await self.historical_tool.execute(
                location=location,
                month=entities.target_month,
                date=entities.target_date,
                year=entities.target_year,
            )
            collected_context["historical_baseline"] = h_res.get("data", {})
            tool_audit_trail.append("get_historical_weather")
            source_provider = "Open-Meteo Global Reanalysis Archive" if entities.target_date else "India Meteorological Department (IMD) 30-Year Normals"
            citations.append(
                CitationSource(
                    title="Historical Meteorological Archive & Climatology",
                    provider=source_provider,
                    station_or_model=f"{location.name if location else 'Station'} - {entities.target_date or entities.target_month.capitalize()}",
                    timestamp=h_res.get("retrieved_at", ""),
                    data_points=["mean_temp", "recorded_rainfall_mm", "record_max_temp", "record_min_temp", "max_wind_speed_kmh"],
                )
            )

        if "get_climate_trend" in tools_to_run:
            c_res = await self.climate_tool.execute(location=location)
            collected_context["climate_trends"] = c_res.get("trends", {})
            tool_audit_trail.append("get_climate_trend")

        if "get_risk_score" in tools_to_run:
            r_res = await self.risk_tool.execute(
                hazard=entities.hazard,
                location=location,
                weather_context=collected_context.get("current_weather"),
                forecast_context=collected_context.get("forecast"),
                alert_context=collected_context.get("alerts"),
            )
            risk_eval_dict = r_res.get("risk_evaluation", {})
            if risk_eval_dict:
                risk_output = RiskScoreResponse(**risk_eval_dict)
                collected_context["risk"] = risk_eval_dict
                tool_audit_trail.append("get_risk_score")

        if "get_advisory" in tools_to_run:
            ad_res = await self.advisory_tool.execute(
                domain=entities.domain,
                location=location,
                weather_context=collected_context.get("current_weather"),
                forecast_context=collected_context.get("forecast"),
                alert_context=collected_context.get("alerts"),
                user_context=request.user_preferences,
            )
            ad_dict = ad_res.get("advisory", {})
            if ad_dict:
                advisory_output = AdvisoryResponse(**ad_dict)
                collected_context["advisory"] = ad_dict
                tool_audit_trail.append("get_advisory")

        # 4. Synthesize Grounded Response via LLM / Adapter
        system_prompt = get_system_prompt(target_lang)
        llm_response = await self.llm_adapter.generate_grounded_response(
            system_prompt=system_prompt,
            user_prompt=prompt,
            context_data=collected_context,
            language=target_lang,
        )

        # 5. Build Final Response Payload
        latency_ms = int((time.time() - start_time) * 1000)

        tts_hint = None
        if llm_response.tts_friendly_text:
            tts_hint = {
                "text": llm_response.tts_friendly_text,
                "language": target_lang,
                "voice_speed": "1.0",
            }

        weather_report_data = {
            "location": collected_context.get("location"),
            "current_weather": collected_context.get("current_weather"),
            "forecast": collected_context.get("forecast"),
            "historical_baseline": collected_context.get("historical_baseline"),
            "alerts": collected_context.get("alerts"),
        }

        return ChatResponse(
            request_id=request.request_id,
            answer=llm_response.answer,
            intent=intent.value,
            language=target_lang,
            sources=citations,
            data_timestamp=datetime.utcnow().isoformat() + "Z",
            confidence=llm_response.confidence,
            risk=risk_output,
            advisory=advisory_output,
            follow_up_questions=llm_response.follow_up_questions,
            model_version="weathergpt-v1.0",
            latency_ms=latency_ms,
            tool_calls_executed=tool_audit_trail,
            weather_report=weather_report_data,
            tts_hint=tts_hint,
        )
