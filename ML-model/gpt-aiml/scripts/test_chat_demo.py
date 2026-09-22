"""Interactive and Automated SIH Demo Scenarios Test Script for WeatherGPT AI/ML."""
import asyncio
import os
import sys

# Reconfigure stdout to utf-8 for Windows PowerShell / Terminal support
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure root directory is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agent.orchestrator import AgentOrchestrator
from app.schemas.chat import ChatRequest
from app.schemas.common import GeoLocation
from app.services.advisory_service import AdvisoryService
from app.services.anomaly_service import AnomalyService
from app.services.climate_service import ClimateService
from app.services.risk_service import RiskService
from app.schemas.risk import HazardType, RiskScoreRequest
from app.schemas.advisory import AdvisoryDomain, AdvisoryRequest
from app.schemas.climate import ClimateMetric, ClimateTrendRequest
from app.schemas.anomaly import AnomalyDetectRequest


async def run_sih_demo_scenarios():
    print("=" * 80)
    print(" [WEATHERGPT AI/ML INTELLIGENCE ENGINE] - SIH DEMO TEST SUITE")
    print("=" * 80)

    orchestrator = AgentOrchestrator()
    risk_service = RiskService()
    advisory_service = AdvisoryService()
    anomaly_service = AnomalyService()
    climate_service = ClimateService()

    # Scenario 1: Current Weather Query
    print("\n[SCENARIO 1: Current Weather Intelligence (English)]")
    req1 = ChatRequest(
        message="What is the current temperature and atmospheric conditions in Lucknow?",
        location=GeoLocation(name="Lucknow"),
    )
    res1 = await orchestrator.process_chat(req1)
    print(f"Intent: {res1.intent}")
    print(f"Answer: {res1.answer}")
    print(f"Tools Executed: {res1.tool_calls_executed}")
    print(f"Confidence: {res1.confidence * 100}% | Latency: {res1.latency_ms}ms")

    # Scenario 2: Severe Weather & Risk Engine
    print("\n[SCENARIO 2: Severe Weather Risk Scoring & Official Warning Isolation]")
    risk_req = RiskScoreRequest(
        hazard=HazardType.HEAVY_RAIN,
        location=GeoLocation(name="Lucknow"),
        weather_context={
            "rainfall_rate": 20.0,
            "rainfall_total": 45.0,
            "precipitation_probability": 90,
            "wind_gust": 45.0,
        },
        alert_context=[
            {
                "hazard": "heavy_rain",
                "severity": "ORANGE",
                "headline": "Orange Alert: Heavy to Very Heavy Rain Spells",
            }
        ]
    )
    risk_res = await risk_service.calculate_risk(risk_req)
    print(f"Hazard: {risk_res.hazard.value.upper()}")
    print(f"Risk Score: {risk_res.score}/100 | Level: {risk_res.level.value}")
    print(f"Official Warning Active: {risk_res.official_warning}")
    print("Contributing Factors:")
    for f in risk_res.factors:
        print(f"  * {f.feature}: observed {f.observed_value} ({f.impact} impact)")
    print(f"Explanation: {risk_res.explanation}")

    # Scenario 3: Agriculture Advisory
    print("\n[SCENARIO 3: Agriculture Domain Advisory (Crop & Spraying Protection)]")
    agri_req = AdvisoryRequest(
        domain=AdvisoryDomain.AGRICULTURE,
        location=GeoLocation(name="Lucknow"),
        weather_context={
            "temperature": 32.0,
            "rainfall_rate": 14.0,
            "precipitation_probability": 85,
            "wind_speed": 24.0,
        }
    )
    agri_res = await advisory_service.generate_advisory(agri_req)
    print(f"Title: {agri_res.title}")
    print(f"Severity: {agri_res.severity.value}")
    print(f"Summary: {agri_res.summary}")
    print("Action Recommendations:")
    for rec in agri_res.recommendations:
        print(f"  [{rec.urgency.upper()}] {rec.action}")
        print(f"    Reason: {rec.reason}")

    # Scenario 4: Travel Advisory (Highway Visibility)
    print("\n[SCENARIO 4: Travel & Highway Driving Advisory]")
    travel_req = AdvisoryRequest(
        domain=AdvisoryDomain.TRAVEL,
        location=GeoLocation(name="New Delhi"),
        weather_context={
            "visibility": 1.5,
            "humidity": 92,
            "wind_speed": 8.0,
        }
    )
    travel_res = await advisory_service.generate_advisory(travel_req)
    print(f"Summary: {travel_res.summary}")
    for rec in travel_res.recommendations:
        print(f"  * {rec.action} ({rec.reason})")

    # Scenario 5: Historical Anomaly & Climate Trends
    print("\n[SCENARIO 5: Statistical Anomaly Detection & Decadal Climate Trends]")
    anom_req = AnomalyDetectRequest(
        location=GeoLocation(name="Lucknow"),
        observed_values={"temperature": 36.5, "rainfall_total": 45.0},
        month=9,
    )
    anom_res = await anomaly_service.detect_anomalies(anom_req)
    print(f"Location: {anom_res.location_name} | Baseline: {anom_res.baseline_period}")
    print(f"Interpretation: {anom_res.interpretation}")
    for metric in anom_res.results:
        print(f"  Metric: {metric.metric.value} | Observed: {metric.observed_value}{metric.units} | Normal: {metric.baseline_mean}{metric.units} | Z-Score: {metric.z_score} ({metric.severity})")

    clim_req = ClimateTrendRequest(
        location=GeoLocation(name="Lucknow"),
        metric=ClimateMetric.TEMPERATURE,
    )
    clim_res = await climate_service.analyze_climate(clim_req)
    print(f"Climate Trend ({clim_res.period}): {clim_res.rate_of_change} | Direction: {clim_res.trend_direction.value}")
    print(f"Summary: {clim_res.summary_narrative}")

    # Scenario 6: Multilingual Hindi Query
    print("\n[SCENARIO 6: Multilingual Hindi Intelligence with Number/Unit Preservation]")
    req_hi = ChatRequest(
        message="क्या लखनऊ में कल भारी बारिश का खतरा है और किसानों को क्या करना चाहिए?",
        location=GeoLocation(name="Lucknow"),
        language="hi",
    )
    res_hi = await orchestrator.process_chat(req_hi)
    print(f"Language: {res_hi.language}")
    print(f"Answer (Hindi): {res_hi.answer}")
    print(f"TTS Hint: {res_hi.tts_hint}")

    print("\n" + "=" * 80)
    print(" [OK] ALL 6 SIH DEMO SCENARIOS COMPLETED SUCCESSFULLY")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_sih_demo_scenarios())
