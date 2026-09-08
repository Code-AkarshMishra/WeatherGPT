"""
gemini_agent.py
Consolidated Natural Language & LLM Tool Calling Engine (ML-1 + ML-2).
Binds live meteorological tools, historical archives, and role-based personas.
Supports multi-key rotation across GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_API_KEY.
Features resilient direct REST calling and complete domain-grounded expert reasoning fallbacks.
"""

import os
import re
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple, List
from dotenv import load_dotenv
import requests

try:
    from .weather_service import get_current_weather, get_historical_weather, search_location
    from .disaster_predictor import disaster_predictor
except ImportError:
    from weather_service import get_current_weather, get_historical_weather, search_location
    from disaster_predictor import disaster_predictor

# Load environment from both local and server .env if present
load_dotenv()
server_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server", ".env"))
if os.path.exists(server_env_path):
    load_dotenv(server_env_path)

# Multi-key rotation pool
def get_gemini_keys() -> List[str]:
    keys = []
    for k in ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"]:
        val = os.getenv(k)
        if val and val.strip() and val.strip() not in keys:
            keys.append(val.strip())
    return keys

SUPPORTED_GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash-lite",
]

# Track key cooldowns: key -> cooldown_until_timestamp
key_cooldowns: Dict[str, float] = {}

def mask_key(key: Optional[str]) -> str:
    if not key or len(key) < 8:
        return "None"
    return f"••••{key[-4:]}"

def get_system_key_status() -> Dict[str, Any]:
    keys = get_gemini_keys()
    now = time.time()
    available = [k for k in keys if key_cooldowns.get(k, 0) <= now]
    active_key = available[0] if available else (keys[0] if keys else None)
    return {
        "provider": "google-gemini-rest",
        "genai_installed": True,
        "total_keys_configured": len(keys),
        "available_keys": len(available),
        "active_key_masked": mask_key(active_key),
        "backup_keys_count": max(0, len(available) - 1),
        "status": "Online" if available else "Expert Meteorological Engine"
    }

def detect_language(text: str) -> str:
    """Detect if the prompt is in Hindi, Hinglish, or English."""
    if re.search(r"[\u0900-\u097F]", text):
        return "hi"
    hinglish_keywords = [
        "kya", "aaj", "kal", "kl", "baarish", "mausam", "khet", "fasal", "hawa", "paani",
        "toofan", "sardi", "garmi", "kab", "kaise", "nikalna", "niklu", "bhi", "jaana",
        "safar", "gumna", "kaisa", "chahiye", "subah", "shaam", "karna", "hai",
        "dawa", "khad", "chhidkao", "barish", "machli", "samundar", "lahar", "batao",
        "kitna", "kitni", "nammi", "tapan", "tapman"
    ]
    text_lower = text.lower()
    if any(re.search(rf"\b{k}\b", text_lower) for k in hinglish_keywords):
        return "hinglish"
    return "en"

def extract_date_from_query(query: str) -> Optional[str]:
    """
    Extracts date string (YYYY-MM-DD) from phrases like:
    - '5th june, 2019'
    - '4th july 2017'
    - '2019-06-05'
    - '15 august 2020'
    - 'yesterday'
    """
    q_lower = query.lower()
    
    if "yesterday" in q_lower or "kal" in q_lower:
        yest = datetime.now() - timedelta(days=1)
        return yest.strftime("%Y-%m-%d")

    # Match format like '5th june, 2019', '4 july 2017', '15th august 2022'
    months = {
        'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
        'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
        'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9, 'october': 10, 'oct': 10,
        'november': 11, 'nov': 11, 'december': 12, 'dec': 12
    }
    month_pattern = "|".join(months.keys())
    
    # Pattern: 5th june, 2019 or 5 june 2019 or june 5 2019
    match1 = re.search(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({month_pattern})[,\s]+(\d{{4}})\b", q_lower)
    if match1:
        day = int(match1.group(1))
        month = months[match1.group(2)]
        year = int(match1.group(3))
        try:
            return f"{year:04d}-{month:02d}-{day:02d}"
        except Exception:
            pass

    match2 = re.search(rf"\b({month_pattern})\s+(\d{{1,2}})(?:st|nd|rd|th)?[,\s]+(\d{{4}})\b", q_lower)
    if match2:
        month = months[match2.group(1)]
        day = int(match2.group(2))
        year = int(match2.group(3))
        try:
            return f"{year:04d}-{month:02d}-{day:02d}"
        except Exception:
            pass

    # Pattern: YYYY-MM-DD
    match_iso = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", query)
    if match_iso:
        return f"{int(match_iso.group(1)):04d}-{int(match_iso.group(2)):02d}-{int(match_iso.group(3)):02d}"

    return None

def extract_location_from_query(query: str) -> Optional[str]:
    """
    Extracts named location from natural language input.
    Handles 'in mumbai', 'humidity in chennai', 'delhi weather', etc.
    """
    q_lower = query.lower()
    
    # 1. Pattern matching with prepositions
    prep_match = re.search(r"\b(?:in|at|for|near|of|me|mein|se)\s+([a-zA-Z\s]{3,25})\b", query, re.IGNORECASE)
    if prep_match:
        cand = prep_match.group(1).strip().rstrip("?,.!")
        # filter out common false-positive words
        stopwords = {
            "today", "tomorrow", "yesterday", "tonight", "now", "the", "this", "my", "our",
            "morning", "evening", "night", "summer", "monsoon", "winter", "a", "an", "detail",
            "details", "weather", "forecast", "report", "temperature", "humidity", "rain"
        }
        cand_words = [w for w in cand.split() if w.lower() not in stopwords]
        if cand_words:
            return " ".join(cand_words)

    # 2. Known major Indian and global cities lookup
    popular_cities = [
        "mumbai", "delhi", "new delhi", "chennai", "kolkata", "bengaluru", "bangalore",
        "hyderabad", "lucknow", "patna", "jaipur", "ahmedabad", "pune", "surat", "kanpur",
        "varanasi", "bhopal", "indore", "guwahati", "chandigarh", "shimla", "dehradun",
        "srinagar", "kochi", "thiruvananthapuram", "visakhapatnam", "nagpur", "agra", "barabanki",
        "london", "new york", "tokyo", "paris", "dubai", "singapore"
    ]
    for city in popular_cities:
        if re.search(rf"\b{city}\b", q_lower):
            return city.title()

    return None

def generate_expert_grounded_reply(
    message: str,
    city_name: str,
    weather: Dict[str, Any],
    risk_info: Dict[str, Any],
    role: str,
    lang: str,
    historical_data: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generates precision-targeted domain reasoning when LLM quota is reached or for rapid responses.
    """
    msg_lower = message.lower()

    # ── A. Historical Query ──────────────────────────────────────────────
    if historical_data:
        date_str = historical_data.get("date", "")
        max_t = historical_data.get("max_temp")
        min_t = historical_data.get("min_temp")
        avg_t = historical_data.get("avg_temp")
        precip = historical_data.get("precipitation_mm", 0.0)
        max_w = historical_data.get("max_wind_kmh", 10.0)
        hum = historical_data.get("avg_humidity", 60)
        cond = historical_data.get("condition", "Partly cloudy")

        if lang in ["hi", "hinglish"]:
            return (
                f"### 📅 **ऐतिहासिक मौसम रिकॉर्ड: {city_name} ({date_str})**\n\n"
                f"**{city_name}** में **{date_str}** को दर्ज किए गए वास्तविक मौसम आंकड़े:\n\n"
                f"- 🌡️ **अधिकतम तापमान:** **{max_t}°C**\n"
                f"- ❄️ **न्यूनतम तापमान:** **{min_t}°C** (औसत: **{avg_t}°C**)\n"
                f"- 💧 **औसत आर्द्रता (Humidity):** **{hum}%**\n"
                f"- 🌧️ **कुल वर्षा (Precipitation):** **{precip} mm**\n"
                f"- 💨 **अधिकतम हवा की गति:** **{max_w} km/h**\n"
                f"- 🌤️ **मौसम की स्थिति:** **{cond}**\n\n"
                f"📌 *स्रोत: Open-Meteo & MoES Climatological Archive Telemetry.*"
            )
        else:
            return (
                f"### 📅 **Historical Weather Record: {city_name} ({date_str})**\n\n"
                f"Archived meteorological observations for **{city_name}** on **{date_str}**:\n\n"
                f"- 🌡️ **Maximum Temperature:** **{max_t}°C**\n"
                f"- ❄️ **Minimum Temperature:** **{min_t}°C** (Mean: **{avg_t}°C**)\n"
                f"- 💧 **Relative Humidity:** **{hum}%**\n"
                f"- 🌧️ **Precipitation Sum:** **{precip} mm**\n"
                f"- 💨 **Peak Wind Velocity:** **{max_w} km/h**\n"
                f"- 🌤️ **Condition:** **{cond}**\n\n"
                f"📌 *Source: Open-Meteo European Centre / GFS Climatological Archive.*"
            )

    temp_val = weather.get("temperature", 28.0)
    feels_like = weather.get("feels_like", temp_val)
    humidity_val = weather.get("humidity", 65)
    wind_val = weather.get("wind_speed_kmh", 12.0)
    cond_val = weather.get("condition", "Partly Cloudy")
    rain_prob = weather.get("rain_probability", 30)
    rain_mm = weather.get("rain_mm", 0.0)
    pressure_val = weather.get("pressure_hpa", 1012)
    imd_color = risk_info.get("imd_color_code", "GREEN")
    risk_assessment = risk_info.get("risk_assessment", "Low / All Clear")

    # ── B. Specific Parameter: Humidity ───────────────────────────────────
    if any(k in msg_lower for k in ["humidity", "nammi", "humid", "moisture", "dew"]):
        if lang in ["hi", "hinglish"]:
            return (
                f"### 💧 **आर्द्रता रिपोर्ट: {city_name}**\n\n"
                f"**{city_name}** में वर्तमान सापेक्षिक आर्द्रता (Relative Humidity) **{humidity_val}%** है।\n\n"
                f"- 🌡️ **तापमान:** **{temp_val}°C** (महसूस: **{feels_like}°C**)\n"
                f"- 💨 **हवा की गति:** **{wind_val} km/h**\n"
                f"- 🌧️ **वर्षा की संभावना:** **{rain_prob}%**\n"
                f"- 📊 **स्थिति:** { 'उच्च आर्द्रता — भारी उमस का अहसास होगा।' if humidity_val >= 75 else 'संतुलित एवं सामान्य आर्द्रता स्तर।' }"
            )
        else:
            return (
                f"### 💧 **Humidity & Moisture Report: {city_name}**\n\n"
                f"The current relative humidity in **{city_name}** is **{humidity_val}%**.\n\n"
                f"- 🌡️ **Temperature:** **{temp_val}°C** (Feels like **{feels_like}°C**)\n"
                f"- 💨 **Wind Speed:** **{wind_val} km/h**\n"
                f"- 🌧️ **Rain Probability:** **{rain_prob}%**\n"
                f"- 📊 **Comfort Level:** { 'High humidity levels — muggy outdoor feel.' if humidity_val >= 75 else 'Comfortable atmospheric humidity.' }"
            )

    # ── C. Specific Parameter: Temperature / Heat ────────────────────────
    if any(k in msg_lower for k in ["how hot", "temperature", "temp", "garmi", "tapman", "heat", "cold", "sardi"]):
        if lang in ["hi", "hinglish"]:
            return (
                f"### 🌡️ **तापमान बुलेटिन: {city_name}**\n\n"
                f"**{city_name}** में वर्तमान तापमान **{temp_val}°C** है (महसूस: **{feels_like}°C**)।\n\n"
                f"- 🌤️ **मौसम की स्थिति:** **{cond_val}**\n"
                f"- 💧 **नमी (Humidity):** **{humidity_val}%**\n"
                f"- 💨 **हवा की गति:** **{wind_val} km/h**\n"
                f"- 🛡️ **आईएमडी चेतावनी स्तर:** **{imd_color}** ({risk_assessment})\n\n"
                f"📌 *{ 'दिन में तीव्र गर्मी की संभावना है, पर्याप्त जल पिएं।' if temp_val >= 38 else 'तापमान सामान्य और अनुकूल सीमा में है।' }*"
            )
        else:
            return (
                f"### 🌡️ **Temperature Bulletin: {city_name}**\n\n"
                f"The current temperature in **{city_name}** is **{temp_val}°C** (Feels like **{feels_like}°C**).\n\n"
                f"- 🌤️ **Sky Condition:** **{cond_val}**\n"
                f"- 💧 **Humidity:** **{humidity_val}%**\n"
                f"- 💨 **Wind Velocity:** **{wind_val} km/h**\n"
                f"- 🛡️ **MoES / IMD Alert Level:** **{imd_color}** ({risk_assessment})\n\n"
                f"📌 *{ 'High heat index. Limit direct sun exposure during afternoon hours.' if temp_val >= 38 else 'Pleasant and comfortable thermal conditions.' }*"
            )

    # ── D. Crop Spraying / Agriculture ───────────────────────────────────
    if any(k in msg_lower for k in ["spray", "fertilizer", "crop", "fasal", "khet", "chhidkao", "khad", "dawa", "irrigation", "sinchai"]):
        spray_safe = (wind_val < 18) and (rain_prob < 50) and (imd_color in ["GREEN", "YELLOW"])
        if lang in ["hi", "hinglish"]:
            status_word = "सुरक्षित है (Safe)" if spray_safe else "सलाह नहीं दी जाती (Not Recommended)"
            reason = "हवा की गति 18 km/h से कम है और बारिश की संभावना कम है।" if spray_safe else f"हवा की गति {wind_val} km/h या बारिश की संभावना ({rain_prob}%) अधिक होने के कारण दवा बह जाने या उड़ने का जोखिम है।"
            return (
                f"### 🌾 **कृषि एवं फसल छिड़काव सलाह: {city_name}**\n\n"
                f"वर्तमान में **{city_name}** में तापमान **{temp_val}°C**, हवा की गति **{wind_val} km/h**, और नमी **{humidity_val}%** है। वर्षा की संभावना **{rain_prob}%** है।\n\n"
                f"#### ✅ **छिड़काव स्थिति:** **{status_word}**\n"
                f"- **कारण:** {reason}\n"
                f"- **अनुकूल समय:** छिड़काव सुबह 7:00 AM से 10:00 AM या शाम 4:30 PM के बाद शांत हवा में करें।\n"
                f"- **आईएमडी अलर्ट स्थिति:** {imd_color} ({risk_assessment})"
            )
        else:
            status_word = "Favorable / Safe to Proceed" if spray_safe else "Unfavorable / Postpone Spraying"
            reason = "Wind velocity is below 18 km/h and rain probability is low." if spray_safe else f"Elevated wind velocity ({wind_val} km/h) or rain probability ({rain_prob}%) poses drift or wash-off risk."
            return (
                f"### 🌾 **Agricultural & Crop Advisory: {city_name}**\n\n"
                f"Observations for **{city_name}**: Temperature **{temp_val}°C**, wind velocity **{wind_val} km/h**, humidity **{humidity_val}%**, and rain probability **{rain_prob}%**.\n\n"
                f"#### 🚜 **Spraying Recommendation:** **{status_word}**\n"
                f"- **Technical Rationale:** {reason}\n"
                f"- **Optimal Window:** 07:00–10:00 hrs or post 16:30 hrs.\n"
                f"- **IMD Alert Status:** {imd_color} ({risk_assessment})"
            )

    # ── E. Marine & Fishing ──────────────────────────────────────────────
    if any(k in msg_lower for k in ["marine", "sea", "wave", "swell", "boat", "machli", "samundar", "lahar", "coastal", "port", "fish"]):
        marine_safe = (wind_val < 35) and (imd_color != "RED")
        wave_height = round(0.5 + (wind_val * 0.05), 1)
        if lang in ["hi", "hinglish"]:
            return (
                f"### ⚓ **समुद्री मौसम एवं नाविक सुरक्षा बुलेटिन: {city_name}**\n\n"
                f"तटीय हवा की गति **{wind_val} km/h** है। अनुमानित लहरों की ऊंचाई लगभग **{wave_height} मीटर** है।\n\n"
                f"- **समुद्र स्थिति:** { 'सामान्य से मध्यम (Safe for operations)' if marine_safe else 'अशांन्त समुद्र चेतावनी (Rough Sea Alert)' }\n"
                f"- **आईएमडी अलर्ट:** {imd_color} ({risk_assessment})"
            )
        else:
            return (
                f"### ⚓ **Marine & Coastal Safety Bulletin: {city_name}**\n\n"
                f"Surface wind velocity in **{city_name}** is **{wind_val} km/h** with significant wave height around **{wave_height} m**.\n\n"
                f"- **Sea State:** { 'Moderate / Operational with standard monitoring.' if marine_safe else 'ROUGH SEA WARNING — Small craft advised to stay in harbor.' }\n"
                f"- **IMD Alert:** {imd_color} ({risk_assessment})"
            )

    # ── F. General / 24-Hour Forecast ─────────────────────────────────────
    if lang in ["hi", "hinglish"]:
        return (
            f"### 🌤️ **24-घंटे मौसम अवलोकन: {city_name}**\n\n"
            f"**{city_name}** में वर्तमान तापमान **{temp_val}°C** (महसूस: **{feels_like}°C**) है और मौसम **{cond_val}** बना हुआ है।\n\n"
            f"- 🌧️ **वर्षा की संभावना:** **{rain_prob}%** (वर्षा: {rain_mm} mm)\n"
            f"- 💧 **आर्द्रता (Humidity):** **{humidity_val}%**\n"
            f"- 💨 **हवा की गति:** **{wind_val} km/h**\n"
            f"- 🛡️ **MoES / IMD अलर्ट:** **{imd_color}** ({risk_assessment})\n\n"
            f"📌 *सुझाव: { 'वर्षा की संभावना है, छाता साथ रखें।' if rain_prob >= 50 else 'दिन भर मौसम सामान्य रूप से अनुकूल रहने का अनुमान है।' }*"
        )
    else:
        return (
            f"### 🌤️ **24-Hour Meteorological Intelligence: {city_name}**\n\n"
            f"Current surface conditions in **{city_name}**: Temperature **{temp_val}°C** (Feels like **{feels_like}°C**) under **{cond_val}** skies.\n\n"
            f"- 🌧️ **Rain Probability:** **{rain_prob}%** (Cumulative: {rain_mm} mm)\n"
            f"- 💧 **Relative Humidity:** **{humidity_val}%**\n"
            f"- 💨 **Wind Velocity:** **{wind_val} km/h**\n"
            f"- 🛡️ **MoES / IMD Severe Index:** **{imd_color}** ({risk_assessment})\n\n"
            f"📌 *Summary: { 'Localized showers likely; keep rain protection handy.' if rain_prob >= 50 else 'Stable meteorological conditions expected over the next 24 hours.' }*"
        )


def answer_query(message: str, lat: Optional[float] = None, lon: Optional[float] = None, role: str = "citizen") -> Tuple[str, str, Dict[str, Any]]:
    """
    Answers natural language queries using live meteorology, historical data retrieval,
    multi-key Gemini REST calling, and resilient domain reasoning.
    """
    lang = detect_language(message)

    # 1. Resolve requested location (e.g. "mumbai", "chennai", "delhi", "lucknow")
    extracted_loc = extract_location_from_query(message)
    resolved_lat = lat if lat is not None else 26.8467
    resolved_lon = lon if lon is not None else 80.9462
    city_name = "Your Area"

    if extracted_loc:
        loc_res = search_location(extracted_loc)
        if loc_res:
            resolved_lat = loc_res["latitude"]
            resolved_lon = loc_res["longitude"]
            city_name = loc_res["full_name"] if loc_res.get("full_name") else loc_res["name"]
    elif lat is not None and lon is not None:
        # Resolve coordinate reverse lookup
        pass

    # 2. Check for historical date in query (e.g. "5th june, 2019")
    target_date = extract_date_from_query(message)
    historical_weather = None
    if target_date:
        historical_weather = get_historical_weather(resolved_lat, resolved_lon, target_date, location_name=city_name)

    # 3. Fetch real-time weather
    weather = get_current_weather(resolved_lat, resolved_lon, location_name=city_name)
    if weather.get("city") and city_name == "Your Area":
        city_name = weather.get("city")

    # 4. Compute MoES Risk Index
    risk_info = disaster_predictor.predict(
        rain_mm=weather.get("rain_mm", 0.0),
        wind_kmph=weather.get("wind_speed_kmh", 10.0),
        temp_c=weather.get("temperature", 25.0),
        city=city_name
    )

    # 5. Attempt Gemini LLM Generation with Valid Models and Key Rotation
    target_lang = 'English' if lang == 'en' else 'Hindi' if lang == 'hi' else 'Hinglish'

    historical_context = ""
    if historical_weather:
        historical_context = (
            f"\nHistorical Weather Observation for {target_date} in {city_name}:\n"
            f"- Max Temp: {historical_weather.get('max_temp')}°C | Min Temp: {historical_weather.get('min_temp')}°C\n"
            f"- Precipitation: {historical_weather.get('precipitation_mm')} mm\n"
            f"- Max Wind: {historical_weather.get('max_wind_kmh')} km/h | Humidity: {historical_weather.get('avg_humidity')}%\n"
            f"- Weather Condition: {historical_weather.get('condition')}\n"
        )

    system_prompt = f"""You are WeatherGPT AI — an authoritative meteorologist, climatologist, and agricultural advisor.
User Persona Role: {role.upper()}
Target Language: {target_lang}

Live Current Meteorological Telemetry:
- Location: {city_name} (Coordinates: {resolved_lat:.4f}, {resolved_lon:.4f})
- Current Temperature: {weather.get('temperature')}°C (Feels like: {weather.get('feels_like')}°C)
- Relative Humidity: {weather.get('humidity')}% | Surface Pressure: {weather.get('pressure_hpa', 1012)} hPa
- Wind Velocity: {weather.get('wind_speed_kmh')} km/h (Direction: {weather.get('wind_direction', 0)}°)
- Rain Probability: {weather.get('rain_probability', 30)}% | Current Precipitation: {weather.get('rain_mm', 0)} mm
- MoES / IMD Alert Status: {risk_info.get('imd_color_code', 'GREEN')} ({risk_info.get('risk_assessment', 'Low')})
{historical_context}

CRITICAL RULES:
1. Directly answer the user's specific question (e.g. if asked about humidity in Chennai, give the humidity for Chennai immediately).
2. If asked about a past date, reference the exact historical numbers provided above.
3. Respond in {target_lang}. If Hindi, write in clear Hindi (Devanagari). If English, write in crisp, professional English.
4. Format using clean Markdown with bold headers and bullet points."""

    keys = get_gemini_keys()
    now = time.time()
    
    for key in keys:
        if key_cooldowns.get(key, 0) > now:
            continue
        for model in SUPPORTED_GEMINI_MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": f"{system_prompt}\n\nUser Question: {message}"}
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 800
                    }
                }
                res = requests.post(url, json=payload, timeout=6.0)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and parts[0].get("text"):
                            reply_text = parts[0]["text"].strip()
                            if len(reply_text) > 15:
                                return reply_text, lang, risk_info
                elif res.status_code in [429, 403]:
                    key_cooldowns[key] = time.time() + 60.0
                    break
            except Exception:
                continue

    # 6. High-Accuracy Grounded Meteorological Fallback
    expert_reply = generate_expert_grounded_reply(
        message=message,
        city_name=city_name,
        weather=weather,
        risk_info=risk_info,
        role=role,
        lang=lang,
        historical_data=historical_weather
    )

    return expert_reply, lang, risk_info

