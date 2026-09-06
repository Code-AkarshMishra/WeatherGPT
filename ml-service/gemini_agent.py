"""
gemini_agent.py
Consolidated Natural Language & LLM Tool Calling Engine (ML-1 + ML-2).
Binds Gemini with live meteorological tools and role-based personas (Farmer, Marine, Citizen).
"""

import os
import re
from datetime import date
from typing import Dict, Any, Optional, Tuple
from dotenv import load_dotenv

# Try importing google-genai
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

try:
    from .weather_service import get_current_weather, search_location
    from .disaster_predictor import disaster_predictor
except ImportError:
    from weather_service import get_current_weather, search_location
    from disaster_predictor import disaster_predictor

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

client = None
if GENAI_AVAILABLE and api_key:
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"[Gemini] Init warning: {e}")

def detect_language(text: str) -> str:
    """Detect if the prompt is in Hindi, Hinglish, or English."""
    if re.search(r"[\u0900-\u097F]", text):
        return "hi"
    hinglish_keywords = ["kya", "aaj", "kal", "baarish", "mausam", "khet", "fasal", "hawa", "paani", "toofan", "sardi", "garmi"]
    text_lower = text.lower()
    if any(re.search(rf"\b{k}\b", text_lower) for k in hinglish_keywords):
        return "hinglish"
    return "en"

def answer_query(message: str, lat: Optional[float] = None, lon: Optional[float] = None, role: str = "citizen") -> Tuple[str, str, Dict[str, Any]]:
    """
    Answers natural language queries using grounded meteorological data and role reasoning.
    Returns (response_text, detected_language, disaster_risk_dict).
    """
    lang = detect_language(message)

    # 1. Resolve coordinates
    resolved_lat = lat if lat is not None else 26.8467 # Lucknow default
    resolved_lon = lon if lon is not None else 80.9462
    city_name = "Your Location"

    # Check if a city was named in the query
    words = message.split()
    for w in words:
        if len(w) > 3 and w.isalpha() and w[0].isupper():
            loc = search_location(w)
            if loc:
                resolved_lat = loc["latitude"]
                resolved_lon = loc["longitude"]
                city_name = loc["name"]
                break

    # 2. Fetch live meteorological observations
    weather = get_current_weather(resolved_lat, resolved_lon)

    # 3. Calculate MoES Severe-Weather Risk (ML-2)
    risk_info = disaster_predictor.predict(
        rain_mm=weather.get("rain_mm", 0.0),
        wind_kmph=weather.get("wind_speed_kmh", 10.0),
        temp_c=weather.get("temperature", 25.0),
        city=city_name
    )

    # 4. Generate LLM Grounded Response
    system_prompt = f"""
You are WeatherGPT AI — an expert meteorologist and agricultural advisor.
User Role: {role.upper()}
Language: Respond in {'Hindi' if lang == 'hi' else 'Hinglish' if lang == 'hinglish' else 'English'}.
Live Meteorological Ground Truth:
- Location: {city_name} (lat: {resolved_lat}, lon: {resolved_lon})
- Temperature: {weather.get('temperature')}°C (Feels like: {weather.get('feels_like')}°C)
- Humidity: {weather.get('humidity')}%
- Condition: {weather.get('condition')}
- Rainfall: {weather.get('rain_mm')} mm
- Wind Speed: {weather.get('wind_speed_kmh')} km/h
- Official IMD Alert: {risk_info['imd_color_code']} ({risk_info['status_text']})
- MoES Risk Level: {risk_info['risk_assessment']}
- Farmer Advisory: {risk_info['farmer_advisory']['hi'] if lang in ['hi', 'hinglish'] else risk_info['farmer_advisory']['en']}
- Marine Advisory: {risk_info['marine_advisory']['hi'] if lang in ['hi', 'hinglish'] else risk_info['marine_advisory']['en']}

Rules:
1. Never hallucinate weather metrics. Always reference the live data above.
2. If role is 'farmer', give actionable guidance on irrigation, crop safety, and field drainage.
3. If role is 'marine', advise on sea conditions, wind chop, and small craft safety.
4. Keep the reply clear, friendly, and practical (2-4 concise paragraphs).
"""

    if client:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=f"{system_prompt}\n\nUser Question: {message}",
            )
            if response and response.text:
                return response.text.strip(), lang, risk_info
        except Exception as e:
            print(f"[Gemini] Error calling model: {e}")

    # Fallback heuristic if API key is not configured or offline
    if role == "farmer":
        if lang in ["hi", "hinglish"]:
            reply = f"Ram-Ram! {city_name} me abhi taapman {weather.get('temperature')}°C hai aur nami {weather.get('humidity')}% hai. IMD ka **{risk_info['imd_color_code']} ALERT** hai. {risk_info['farmer_advisory']['hi']}"
        else:
            reply = f"Greetings! Currently in {city_name}, temperature is {weather.get('temperature')}°C with {weather.get('humidity')}% humidity. IMD Status: **{risk_info['imd_color_code']} ALERT** ({risk_info['risk_assessment']} Risk). {risk_info['farmer_advisory']['en']}"
    elif role == "marine":
        if lang in ["hi", "hinglish"]:
            reply = f"Mausam update: {city_name} ke tatiya kshetra me hawa ki gati {weather.get('wind_speed_kmh')} km/h hai. IMD **{risk_info['imd_color_code']} ALERT**. {risk_info['marine_advisory']['hi']}"
        else:
            reply = f"Maritime Advisory for {city_name}: Coastal wind speed is {weather.get('wind_speed_kmh')} km/h. IMD **{risk_info['imd_color_code']} ALERT**. {risk_info['marine_advisory']['en']}"
    else:
        if lang in ["hi", "hinglish"]:
            reply = f"{city_name} me mausam {weather.get('condition')} hai, taapman {weather.get('temperature')}°C (ehsaas {weather.get('feels_like')}°C). IMD Alert: **{risk_info['imd_color_code']}**. Hawa {weather.get('wind_speed_kmh')} km/h chal rahi hai."
        else:
            reply = f"Current weather in {city_name} is {weather.get('condition')} with a temperature of {weather.get('temperature')}°C (feels like {weather.get('feels_like')}°C). IMD Warning: **{risk_info['imd_color_code']}** ({risk_info['risk_assessment']} Risk)."

    return reply, lang, risk_info
