"""Interactive CLI Chat for WeatherGPT AI/ML Intelligence Service."""
import asyncio
import os
import sys

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")

# Ensure root directory is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agent.orchestrator import AgentOrchestrator
from app.schemas.chat import ChatRequest


async def main():
    print("=" * 75)
    print(" 🌦️  WEATHERGPT — INTERACTIVE TERMINAL CHAT")
    print(" (Type any weather question in English or Hindi. Type 'exit' to quit)")
    print("=" * 75)

    orchestrator = AgentOrchestrator()

    while True:
        try:
            print("\n" + "-" * 75)
            user_input = input("👉 Enter your question (Aapka Sawaal): ").strip()

            if not user_input:
                continue

            if user_input.lower() in ("exit", "quit", "q", "bye"):
                print("\n👋 WeatherGPT session ended. Goodbye!\n")
                break

            print("\n⏳ Processing with Weather Intelligence Engine...")

            req = ChatRequest(message=user_input)
            response = await orchestrator.process_chat(req)

            # 1. Weather Data Report (from Weather APIs - Open-Meteo & IMD)
            report = response.weather_report or {}
            curr = report.get("current_weather")
            hist = report.get("historical_baseline")
            fc = report.get("forecast")
            loc = report.get("location") or {}

            print("\n" + "=" * 75)
            print(f"📡 1. METEOROLOGICAL DATA REPORT (Source: Open-Meteo / IMD Stations)")
            print("=" * 75)
            if loc:
                print(f"📍 Location: {loc.get('name', 'Unknown')}, {loc.get('state', '')} ({loc.get('lat', '')}°N, {loc.get('lon', '')}°E)")

            if curr:
                print(f"🌤️ Condition:     {curr.get('condition', 'N/A')}")
                print(f"🌡️ Temperature:   {curr.get('temperature', 'N/A')}°C  (Feels like: {curr.get('feels_like', 'N/A')}°C)")
                print(f"💧 Humidity:      {curr.get('humidity', 'N/A')}%")
                print(f"🌧️ Rainfall Rate: {curr.get('rainfall_rate', 'N/A')} mm/h")
                print(f"💨 Wind Speed:    {curr.get('wind_speed', 'N/A')} km/h ({curr.get('wind_direction', '')})")
                print(f"🏷️ Data Provider: {curr.get('source', 'Open-Meteo Live NWP')}")

            if hist:
                print(f"📜 Historical:    {hist.get('date', hist.get('month', 'Record'))}")
                if 'mean_temp' in hist:
                    print(f"   • Mean Temp:    {hist.get('mean_temp')}°C  (Max: {hist.get('record_max_temp')}°C, Min: {hist.get('record_min_temp')}°C)")
                if 'recorded_rainfall_mm' in hist:
                    print(f"   • Rainfall:     {hist.get('recorded_rainfall_mm')} mm")
                if 'condition' in hist:
                    print(f"   • Condition:    {hist.get('condition')}")
                print(f"   • Data Source:  {hist.get('source', 'Historical Archive')}")

            if fc and isinstance(fc, list) and len(fc) > 0:
                print(f"\n📅 Multi-Day Forecast (Open-Meteo Ensemble):")
                for day in fc[:3]:
                    print(
                        f"   • {day.get('date')}: "
                        f"{day.get('temp_max') if day.get('temp_max') is not None else 'n/a'}°C / "
                        f"{day.get('temp_min') if day.get('temp_min') is not None else 'n/a'}°C | "
                        f"Rain: {day.get('rainfall_total') if day.get('rainfall_total') is not None else 'n/a'}mm "
                        f"(PoP: {day.get('precipitation_probability') if day.get('precipitation_probability') is not None else 'n/a'}%) | "
                        f"{day.get('condition') or 'n/a'}"
                    )

            # 2. AI Intelligence Answer (from Gemini LLM)
            print("\n" + "=" * 75)
            print(f"🤖 2. WEATHERGPT INTELLIGENCE & ADVISORY (Powered by Gemini AI - {response.language.upper()}):")
            print("=" * 75)
            print(response.answer)

            # 3. Risk & Official Advisories
            if response.risk:
                print(f"\n⚠️ Risk Evaluation: {response.risk.hazard.value.upper()} -> Score: {response.risk.score}/100 ({response.risk.level.value})")
                print(f"  {response.risk.explanation}")

            if response.advisory:
                print(f"\n🌾 Sector Advisory [{response.advisory.domain.value.upper()}]: {response.advisory.title}")
                for rec in response.advisory.recommendations[:2]:
                    print(f"  • [{rec.urgency.upper()}] {rec.action}")

            if response.follow_up_questions:
                print(f"\n💡 Suggested Follow-up Questions:")
                for q in response.follow_up_questions:
                    print(f"  👉 {q}")

            print(f"\n⚡ Response Metadata: Intent={response.intent} | Latency={response.latency_ms}ms | Confidence={response.confidence * 100:.1f}%")

        except (KeyboardInterrupt, EOFError):
            print("\n\n👋 WeatherGPT session closed.")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
