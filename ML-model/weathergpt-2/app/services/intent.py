"""Lightweight intent labels for MERN UI chips. Gemini still chooses tools."""
import re


# Order matters: more specific intents BEFORE generic ones.
INTENT_PATTERNS = [
    (
        "nwp_verification",
        re.compile(
            r"\b("
            r"how\s+accurate|forecast\s+error|forecast\s+verification|"
            r"gfs\s+been|mae|previous\s+runs?|"
            r"compare\s+gfs|gfs\s+and\s+ecmwf\s+rainfall\s+forecast"
            r")\b",
            re.I,
        ),
    ),
    (
        "historical_compare",
        re.compile(
            r"\b(compare\s+rainfall|compared\s+with|compared\s+to|"
            r"vs\.?|versus)\b",
            re.I,
        ),
    ),
    (
        "historical",
        re.compile(
            r"\b("
            r"19\d{2}|20\d{2}|historical|history|past\s*weather|"
            r"last\s+\d+\s+years?|last\s+\d+\s+months?|last\s+\d+\s+days?|"
            r"over\s+the\s+last|how\s+much\s+has\s+it\s+rained|"
            r"unusually\s+high|hotter\s+than\s+usual|how\s+often|"
            r"highest\s+rainfall|how\s+unusual|"
            r"पुराना\s*मौसम"
            r")\b",
            re.I,
        ),
    ),
    (
        "climate_trend",
        re.compile(
            r"\b(climate|climate\s*change|climate\s*trend|warming\s*trend|decade|"
            r"जलवायु)\b",
            re.I,
        ),
    ),
    (
        "anomaly_inquiry",
        re.compile(
            r"\b(anomaly|unusual|departure|record\s*break|abnormal|विसंगति|असामान्य)\b",
            re.I,
        ),
    ),
    (
        "nwp_hazard",
        re.compile(
            r"\b("
            r"nwp|gfs|ecmwf|early\s*warning|hazard\s*alert|"
            r"live\s*alert|model\s*agreement|convective\s*hazard"
            r")\b",
            re.I,
        ),
    ),
    (
        "disaster_risk",
        re.compile(
            r"\b("
            r"disaster[- ]related|disaster\s*risk\w*|disaster\s*prepared\w*|disaster\s*management|"
            r"severe\s*weather|developing\s*hazard\w*|weather\s*threat|"
            r"emergency\s*weather|cyclone[- ]related|waterlog|"
            r"what\s+hazards|any\s+hazards|related\s+hazards|hazardous\s+weather|"
            r"flood\s*(?:and\s*)?disaster|authorities\s+watch|"
            r"आपदा|जलभराव"
            r")\b",
            re.I,
        ),
    ),
    (
        "alert_inquiry",
        re.compile(
            r"\b(alert\w*|warning\w*|red\s*alert|orange\s*alert|cyclon\w*|चेतावनी|अलर्ट)\b",
            re.I,
        ),
    ),
    (
        "advisory_request",
        re.compile(
            r"\b(should\s*i|advice|advis\w*|suggest\w*|umbrella|farm\w*|crop\w*|"
            r"spray\w*|irrigat\w*|harvest|travel\w*|commute|office|सलाह|खेती|फसल)\b",
            re.I,
        ),
    ),
    (
        "risk_assessment",
        re.compile(
            r"\b(risk\w*|danger\w*|hazard\w*|flood\w*|heatwave|जोखिम|खतरा|बाढ़)\b",
            re.I,
        ),
    ),
    (
        "forecast",
        re.compile(
            r"\b("
            r"tomorrow|will\s*it|forecast\w*|next\s+\d+\s+days?|next\s+week|"
            r"upcoming|tonight|weekend|this\s+week|for\s+the\s+next|"
            r"7\s*days?|\bweek\b|"
            r"कल|परसों|आने\s*वाल|पूर्वानुमान|अगले\s*\d+\s*दिन"
            r")\b",
            re.I,
        ),
    ),
    (
        "current_weather",
        re.compile(
            r"\b("
            r"current|right\s+now|now|today'?s?|at\s+the\s+moment|"
            r"humidity|temp(?:erature)?|"
            r"अभी|आज\s*का|वर्तमान"
            r")\b",
            re.I,
        ),
    ),
]


def classify_intent(query: str) -> str:
    clean = (query or "").strip()
    if not clean:
        return "general"

    # Explicit multi-day forecast phrases beat generic "weather"
    if re.search(
        r"\b(next\s+\d+\s+days?|next\s+week|7\s*days?|for\s+the\s+next|"
        r"forecast|will\s+the\s+weather|how\s+will\s+the\s+weather)\b",
        clean,
        re.I,
    ):
        return "forecast"

    for intent, pattern in INTENT_PATTERNS:
        if pattern.search(clean):
            return intent

    # Bare "weather in X" without time → current
    if re.search(r"\bweather\b", clean, re.I):
        return "current_weather"

    return "general"
