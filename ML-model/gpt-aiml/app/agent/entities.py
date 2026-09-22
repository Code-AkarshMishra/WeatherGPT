"""Entity extraction from multilingual queries."""
import re
from typing import Any, Dict, List, Optional
from app.schemas.advisory import AdvisoryDomain
from app.schemas.common import GeoLocation
from app.schemas.risk import HazardType


class ExtractedEntities:
    """Container for extracted query entities."""

    def __init__(
        self,
        location: Optional[GeoLocation] = None,
        time_horizon: str = "current",
        hazard: HazardType = HazardType.COMPOSITE,
        domain: AdvisoryDomain = AdvisoryDomain.URBAN_GENERAL,
        language: str = "en",
        target_month: Optional[str] = None,
        target_year: Optional[str] = None,
        target_date: Optional[str] = None,
    ):
        self.location = location
        self.time_horizon = time_horizon
        self.hazard = hazard
        self.domain = domain
        self.language = language
        self.target_month = target_month
        self.target_year = target_year
        self.target_date = target_date

    def to_dict(self) -> Dict[str, Any]:
        return {
            "location": self.location.model_dump() if self.location else None,
            "time_horizon": self.time_horizon,
            "hazard": self.hazard.value,
            "domain": self.domain.value,
            "language": self.language,
            "target_month": self.target_month,
            "target_year": self.target_year,
            "target_date": self.target_date,
        }


class EntityExtractor:
    """Extracts meteorological entities from multilingual queries."""

    # Major Indian cities lookup
    KNOWN_CITIES = {
        "lucknow": ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
        "लखनऊ": ("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
        "new delhi": ("New Delhi", "Delhi", 28.6139, 77.2090),
        "delhi": ("New Delhi", "Delhi", 28.6139, 77.2090),
        "नई दिल्ली": ("New Delhi", "Delhi", 28.6139, 77.2090),
        "दिल्ली": ("New Delhi", "Delhi", 28.6139, 77.2090),
        "mumbai": ("Mumbai", "Maharashtra", 19.0760, 72.8777),
        "बॉम्बे": ("Mumbai", "Maharashtra", 19.0760, 72.8777),
        "मुंबई": ("Mumbai", "Maharashtra", 19.0760, 72.8777),
        "bengaluru": ("Bengaluru", "Karnataka", 12.9716, 77.5946),
        "bangalore": ("Bengaluru", "Karnataka", 12.9716, 77.5946),
        "बेंगलुरु": ("Bengaluru", "Karnataka", 12.9716, 77.5946),
        "kolkata": ("Kolkata", "West Bengal", 22.5726, 88.3639),
        "कोलकाता": ("Kolkata", "West Bengal", 22.5726, 88.3639),
        "chennai": ("Chennai", "Tamil Nadu", 13.0827, 80.2707),
        "चेन्नई": ("Chennai", "Tamil Nadu", 13.0827, 80.2707),
        "shimla": ("Shimla", "Himachal Pradesh", 31.1048, 77.1734),
        "शिमला": ("Shimla", "Himachal Pradesh", 31.1048, 77.1734),
        "guwahati": ("Guwahati", "Assam", 26.1445, 91.7362),
        "गुवाहाटी": ("Guwahati", "Assam", 26.1445, 91.7362),
    }

    # Month keyword mapping
    MONTHS = {
        "january": "january", "jan": "january", "जनवरी": "january",
        "february": "february", "feb": "february", "फरवरी": "february",
        "march": "march", "mar": "march", "मार्च": "march",
        "april": "april", "apr": "april", "अप्रैल": "april",
        "may": "may", "मई": "may",
        "june": "june", "jun": "june", "जून": "june",
        "july": "july", "jul": "july", "जुलाई": "july",
        "august": "august", "aug": "august", "अगस्त": "august",
        "september": "september", "sep": "september", "सितंबर": "september",
        "october": "october", "oct": "october", "अक्टूबर": "october",
        "november": "november", "nov": "november", "नवंबर": "november",
        "december": "december", "dec": "december", "दिसंबर": "december",
    }

    # Unambiguous Hinglish indicators (words that do NOT conflict with common English words)
    HINGLISH_WORDS = {
        "batao", "bataiye", "kya", "kaisa", "kaisi", "kaise", "mausam", "barish", "baaris",
        "barsat", "tapman", "hogi", "hoga", "hoge", "hai", "hain", "tha", "thi", "aaj",
        "kal", "parso", "abhi", "mujhe", "mera", "meri", "mere", "kaha", "kidhar",
        "chahiye", "mein", "rahega", "rahegi", "rahenge", "dikhao", "sunao", "kuch",
        "wala", "wali", "wale", "kare", "karo", "kariye", "karein", "hona", "hone",
        "lagi", "laga", "lage", "paas", "nahi", "nahin", "nhi", "kyu", "kyun", "kyon",
        "kitna", "kitni", "kitne", "accha", "achha", "thik", "theek", "zyada", "jyada",
        "kam", "halka", "halki", "tez", "bata", "bolo", "boliye", "bhai", "bhaiya"
    }

    # Common English words
    ENGLISH_WORDS = {
        "what", "is", "are", "how", "why", "when", "where", "which", "who", "whom",
        "whose", "the", "tell", "give", "show", "weather", "forecast", "temperature",
        "rain", "rainfall", "today", "tomorrow", "yesterday", "please", "current",
        "condition", "conditions", "will", "would", "could", "should", "does", "do",
        "can", "about", "there", "any", "alerts", "alert", "humidity", "wind", "speed",
        "history", "historical", "report", "update", "check", "need", "like", "in", "at", "for"
    }

    @classmethod
    def detect_language(cls, text: str, supplied_language: str = "en") -> str:
        """Accurately detect whether text is Devanagari Hindi, Hinglish, or English."""
        if not text:
            return supplied_language

        # 1. Check for Devanagari script
        if any('\u0900' <= char <= '\u097F' for char in text):
            return "hi"

        # 2. Tokenize lowercase words
        tokens = set(re.findall(r'[a-zA-Z]+', text.lower()))
        if not tokens:
            return supplied_language

        hinglish_matches = tokens.intersection(cls.HINGLISH_WORDS)
        english_matches = tokens.intersection(cls.ENGLISH_WORDS)

        # Hinglish particle checks (e.g., "ka", "ki", "ke", "ko", "se", "pe" combined with other words)
        particles = tokens.intersection({"ka", "ki", "ke", "ko", "se", "pe"})
        
        # If unambiguous Hinglish words exist, classify as hinglish
        if len(hinglish_matches) > 0 or (len(particles) > 0 and len(english_matches) <= len(particles)):
            return "hinglish"

        # If English words dominate or no Hinglish indicators found, return English
        if len(english_matches) > 0:
            return "en"

        return supplied_language

    @classmethod
    def extract(
        cls,
        text: str,
        supplied_location: Optional[GeoLocation] = None,
        supplied_language: str = "en"
    ) -> ExtractedEntities:
        """Extract all relevant entities."""
        clean = (text or "").strip().lower()

        # 1. Location extraction
        location = supplied_location
        if not location or not location.name:
            for city_key, city_meta in cls.KNOWN_CITIES.items():
                if re.search(rf'\b{re.escape(city_key)}\b', clean):
                    location = GeoLocation(
                        name=city_meta[0],
                        state=city_meta[1],
                        lat=city_meta[2],
                        lon=city_meta[3],
                    )
                    break

        if not location:
            location = None  # Do not invent a default city / coordinates

        # 2. Year, Month & Date Extraction
        year_match = re.search(r'\b(19\d\d|200\d|201\d|202[0-5])\b', clean)
        target_year = year_match.group(0) if year_match else None

        from datetime import datetime

        target_month = datetime.utcnow().strftime("%B").lower()
        month_found = False
        for m_key, m_val in cls.MONTHS.items():
            if re.search(rf'\b{re.escape(m_key)}\b', clean):
                target_month = m_val
                month_found = True
                break

        # Check for day of month (e.g. "03", "3", "3rd", "15th")
        target_date = None
        if target_year:
            month_num_map = {
                "january": "01", "february": "02", "march": "03", "april": "04",
                "may": "05", "june": "06", "july": "07", "august": "08",
                "september": "09", "october": "10", "november": "11", "december": "12"
            }
            # Look for 1-31 before or after the month/year
            day_match = re.search(r'\b(0?[1-9]|[12]\d|3[01])(?:\s*(?:th|st|nd|rd))?\b', clean)
            if day_match and month_found:
                day_num = int(day_match.group(1))
                m_num = month_num_map.get(target_month, "07")
                target_date = f"{target_year}-{m_num}-{day_num:02d}"

        # 3. Time Horizon
        time_horizon = "current"
        if target_date:
            time_horizon = f"historical_{target_date}"
        elif target_year:
            time_horizon = f"historical_{target_year}"
        elif re.search(r'\b(tomorrow|कल|next\s*day)\b', clean):
            time_horizon = "tomorrow"
        elif re.search(r'\b(week|weekend|7\s*days|आने\s*वाले\s*दिन)\b', clean):
            time_horizon = "weekly"
        elif re.search(r'\b(tonight|आज\s*रात|evening)\b', clean):
            time_horizon = "tonight"

        # 4. Hazard
        hazard = HazardType.COMPOSITE
        if re.search(r'\b(rain\w*|flood\w*|downpour\w*|बारिश|वर्षा|जलभराव|बाढ़)\b', clean):
            hazard = HazardType.HEAVY_RAIN
        elif re.search(r'\b(heat|hot|heatwave|गर्मी|लू|धूप)\b', clean):
            hazard = HazardType.HEAT
        elif re.search(r'\b(thunder\w*|lightning\w*|storm\w*|आंधी|तूफान|बिजली)\b', clean):
            hazard = HazardType.THUNDERSTORM
        elif re.search(r'\b(wind\w*|squall\w*|हवा|तेज\s*हवा)\b', clean):
            hazard = HazardType.HIGH_WIND
        elif re.search(r'\b(fog\w*|visibility|smog\w*|कोहरा|धुंध)\b', clean):
            hazard = HazardType.FOG_VISIBILITY
        elif re.search(r'\b(cold\w*|frost\w*|शीतलहर|ठंड)\b', clean):
            hazard = HazardType.COLD_WAVE

        # 5. Domain
        domain = AdvisoryDomain.URBAN_GENERAL
        if re.search(r'\b(crop\w*|farm\w*|irrigat\w*|spray\w*|pesticide\w*|fertilizer\w*|किसान|खेती|फसल|सिंचाई|कीटनाशक)\b', clean):
            domain = AdvisoryDomain.AGRICULTURE
        elif re.search(r'\b(travel\w*|flight\w*|train\w*|drive|driving|highway\w*|commute\w*|route\w*|यात्रा|सड़क|हाईवे|गाड़ी)\b', clean):
            domain = AdvisoryDomain.TRAVEL
        elif re.search(r'\b(disaster\w*|cyclon\w*|evacuat\w*|ndrf|shelter\w*|आपदा|चक्रवात|सुरक्षित\s*स्थान)\b', clean):
            domain = AdvisoryDomain.DISASTER

        # 6. Language detection: Devanagari Hindi vs Hinglish vs English
        language = cls.detect_language(text, supplied_language=supplied_language)

        return ExtractedEntities(
            location=location,
            time_horizon=time_horizon,
            hazard=hazard,
            domain=domain,
            language=language,
            target_month=target_month,
            target_year=target_year,
            target_date=target_date,
        )
