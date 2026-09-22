"""Unit tests for Intent classification and Entity extraction."""
from app.agent.entities import EntityExtractor
from app.agent.intent import IntentClassifier, UserIntent
from app.schemas.advisory import AdvisoryDomain
from app.schemas.risk import HazardType


def test_intent_classification():
    assert IntentClassifier.classify("What is the current temperature in Delhi?") == UserIntent.CURRENT_WEATHER
    assert IntentClassifier.classify("Will it rain tomorrow in Lucknow?") == UserIntent.FORECAST
    assert IntentClassifier.classify("Are there any active IMD red alerts?") == UserIntent.ALERT_INQUIRY
    assert IntentClassifier.classify("Is there a high risk of flooding tonight?") == UserIntent.RISK_ASSESSMENT
    assert IntentClassifier.classify("Should I spray pesticide on my wheat crop?") == UserIntent.ADVISORY_REQUEST
    assert IntentClassifier.classify("What is the long term climate change trend?") == UserIntent.CLIMATE_TREND
    assert IntentClassifier.classify("Is today's rainfall an anomaly compared to normal?") == UserIntent.ANOMALY_INQUIRY


def test_hindi_intent_classification():
    assert IntentClassifier.classify("लखनऊ में कल का मौसम कैसा रहेगा?") == UserIntent.FORECAST
    assert IntentClassifier.classify("क्या मुंबई में कोई भारी बारिश का अलर्ट है?") == UserIntent.ALERT_INQUIRY
    assert IntentClassifier.classify("क्या मुझे आज फसल में कीटनाशक का छिड़काव करना चाहिए?") == UserIntent.ADVISORY_REQUEST


def test_entity_extraction_multilingual():
    ent1 = EntityExtractor.extract("What is the temperature in Mumbai tomorrow?")
    assert ent1.location.name == "Mumbai"
    assert ent1.time_horizon == "tomorrow"
    assert ent1.language == "en"

    ent2 = EntityExtractor.extract("क्या लखनऊ में आंधी और तूफान का खतरा है?")
    assert ent2.location.name == "Lucknow"
    assert ent2.hazard == HazardType.THUNDERSTORM
    assert ent2.language == "hi"

    ent3 = EntityExtractor.extract("Should I irrigate my crops in New Delhi?")
    assert ent3.location.name == "New Delhi"
    assert ent3.domain == AdvisoryDomain.AGRICULTURE
