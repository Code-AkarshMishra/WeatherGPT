"""Intent classification for meteorological and conversational queries."""
import re
from enum import Enum


class UserIntent(str, Enum):
    CURRENT_WEATHER = "current_weather"
    FORECAST = "forecast"
    ALERT_INQUIRY = "alert_inquiry"
    RISK_ASSESSMENT = "risk_assessment"
    ADVISORY_REQUEST = "advisory_request"
    CLIMATE_TREND = "climate_trend"
    ANOMALY_INQUIRY = "anomaly_inquiry"
    COMPARISON = "comparison"
    HISTORICAL = "historical"
    GENERAL = "general"


class IntentClassifier:
    """Deterministic, high-accuracy intent classification engine."""

    # Keywords mapping with plural/stem support
    INTENT_PATTERNS = [
        (
            UserIntent.HISTORICAL,
            re.compile(r'\b(19\d\d|200\d|201\d|202[0-5]|historical|history|past\s*weather|purana\s*weather|उस\s*साल|उस\s*दिन|पुराना\s*मौसम|इतिहास)\b', re.I)
        ),
        (
            UserIntent.CLIMATE_TREND,
            re.compile(r'\b(climate|climate\s*change|climate\s*trend|warming\s*trend|decade|decadal|long\s*term\s*trend|जलवायु|जलवायु\s*परिवर्तन|जलवायु\s*रुझान)\b', re.I)
        ),
        (
            UserIntent.ANOMALY_INQUIRY,
            re.compile(r'\b(anomaly|anomalies|unusual|departure|record\s*break|normal\s*for|abnormal|deviat\w*|विसंगति|असामान्य|औसत\s*से)\b', re.I)
        ),
        (
            UserIntent.ALERT_INQUIRY,
            re.compile(r'\b(alert\w*|warning\w*|imd\s*alert\w*|red\s*alert|orange\s*alert|yellow\s*alert|cyclon\w*|चेतावनी|अलर्ट|रेड\s*अलर्ट|ऑरेंज\s*अलर्ट)\b', re.I)
        ),
        (
            UserIntent.ADVISORY_REQUEST,
            re.compile(r'\b(should\s*i|advice|advis\w*|suggest\w*|umbrella|farm\w*|crop\w*|spray\w*|irrigat\w*|travel\w*|commute\w*|outdoor|सलाह|सुझाव|छाता|खेती|फसल|यात्रा)\b', re.I)
        ),
        (
            UserIntent.RISK_ASSESSMENT,
            re.compile(r'\b(risk\w*|danger\w*|hazard\w*|flood\w*|heatwave\s*risk|safe\s*to|severe|जोखिम|खतरा|बाढ़|लू)\b', re.I)
        ),
        (
            UserIntent.COMPARISON,
            re.compile(r'\b(compare|comparing|comparison|vs|versus|difference\s*between|which\s*is\s*hotter|तुलना|दोनों\s*में)\b', re.I)
        ),
        (
            UserIntent.FORECAST,
            re.compile(r'\b(tomorrow|will\s*it|forecast\w*|next\s*week|upcoming|next\s*few\s*days|tonight|weekend|कल|परसों|आने\s*वाले|पूर्वानुमान|भविष्यवाणी)\b', re.I)
        ),
        (
            UserIntent.CURRENT_WEATHER,
            re.compile(r'\b(current|now|today|temperature\w*|temp|humidity|rain\s*right\s*now|weather|मौसम|तापमान|आज|अभी)\b', re.I)
        ),
    ]

    @classmethod
    def classify(cls, query: str) -> UserIntent:
        """Classify user query into canonical UserIntent."""
        clean = (query or "").strip().lower()
        if not clean:
            return UserIntent.GENERAL

        for intent, pattern in cls.INTENT_PATTERNS:
            if pattern.search(clean):
                return intent

        return UserIntent.GENERAL
