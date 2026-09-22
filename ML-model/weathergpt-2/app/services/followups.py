"""Suggested follow-up questions — role-aware and language-matched to the user prompt."""
from __future__ import annotations

from typing import Optional

from app.services.language import language_display_name
from app.services.roles import ROLE_FOLLOW_UPS, UserRole, normalize_role

# Legacy intent-only templates (English fallback)
INTENT_FOLLOW_UPS: dict[str, list[str]] = {
    "forecast": [
        "Should I plan outdoor work in {place} this week?",
        "What is the weather like in {place} right now?",
        "Is there any storm risk in {place}?",
    ],
    "advisory_request": [
        "Will it rain tomorrow in {place}?",
        "What is the best time for field work in {place}?",
        "Are there any weather warnings for {place}?",
    ],
}

# Hard-coded templates for common SIH languages (fast, no extra Gemini call).
# Keys: language → role → templates with {place}
_ROLE_FOLLOW_UPS_I18N: dict[str, dict[UserRole, list[str]]] = {
    "hi": {
        UserRole.CITIZEN: [
            "क्या मुझे कल {place} में ऑफिस जाते समय छतरी ले जानी चाहिए?",
            "क्या {place} में शाम की सैर के लिए बहुत गर्मी होगी?",
            "क्या {place} के लिए कोई मौसम चेतावनी है?",
        ],
        UserRole.FARMER: [
            "क्या कल {place} के पास खेतों में सिंचाई करनी चाहिए?",
            "{place} में कीटनाशक छिड़काव का अगला सुरक्षित समय कब है?",
            "क्या इस सप्ताह {place} में भारी बारिश से कटी फसल प्रभावित हो सकती है?",
        ],
        UserRole.RESEARCHER: [
            "{place} में यह सप्ताह मासिक सामान्य से कैसे तुलना करता है?",
            "{place} के अगले 7 दिनों की दैनिक वर्षा बताएँ।",
            "क्या आज का तापमान {place} के लिए असामान्य है?",
        ],
        UserRole.AVIATION: [
            "क्या दृश्यता या हवा {place} के पास सुबह की उड़ानों को प्रभावित करेगी?",
            "क्या व्यस्त समय में {place} के पास तूफान की संभावना है?",
            "{place} के पास 24 घंटे की हवा का रुझान क्या है?",
        ],
        UserRole.MARINE: [
            "क्या {place} के तट पर तेज हवा या झंझावात की संभावना है?",
            "क्या कल {place} के पास छोटी नावों के लिए सुरक्षित है?",
            "इस सप्ताह {place} के पास सबसे शांत समय कब है?",
        ],
        UserRole.CLIMATE_ANALYST: [
            "{place} में अगले सप्ताह तापमान का रुझान क्या है?",
            "इस सप्ताह की वर्षा {place} के सितंबर सामान्य से कैसे तुलना करती है?",
            "क्या अभी {place} में कोई विसंगति संकेत हैं?",
        ],
        UserRole.URBAN_PLANNER: [
            "इस सप्ताह {place} में जलभराव का जोखिम किन दिनों में है?",
            "{place} में बाहरी कामगारों के लिए गर्मी का तनाव कब चरम पर होगा?",
            "क्या यह सप्ताह {place} में बड़े बाहरी कार्यक्रम के लिए उपयुक्त है?",
        ],
        UserRole.AIR_QUALITY: [
            "इस सप्ताह {place} में बाहरी व्यायाम का सबसे अच्छा समय कब है?",
            "क्या कल {place} में नमी और गर्मी से हवा और खराब लगेगी?",
            "क्या {place} में हवा रुकने की स्थिति अपेक्षित है?",
        ],
        UserRole.FLOOD_DISASTER: [
            "{place} में अगले 24 घंटे में कौन-से आपदा संबंधी खतरे बन रहे हैं?",
            "क्या GFS और ECMWF {place} की वर्षा पर सहमत हैं?",
            "क्या {place} के लिए कोई आधिकारिक चेतावनी उपलब्ध है?",
        ],
    },
    "ta": {
        UserRole.CITIZEN: [
            "நாளை {place}-இல் அலுவலகம் செல்லும்போது குடை எடுத்துச் செல்ல வேண்டுமா?",
            "{place}-இல் மாலை நடைக்கு மிகவும் வெப்பமாக இருக்குமா?",
            "{place}-க்கு ஏதேனும் வானிலை எச்சரிக்கை உள்ளதா?",
        ],
        UserRole.FARMER: [
            "நாளை {place} அருகே நீர்ப்பாசனம் செய்யலாமா?",
            "{place}-இல் பூச்சிக்கொல்லி தெளிக்க அடுத்த பாதுகாப்பான நேரம் எப்போது?",
            "இந்த வாரம் {place}-இல் கடும் மழை அறுவடை செய்த பயிரை பாதிக்குமா?",
        ],
    },
    "kn": {
        UserRole.CITIZEN: [
            "ನಾಳೆ {place} ನಲ್ಲಿ ಕಚೇರಿಗೆ ಹೋಗುವಾಗ ಛತ್ರಿ ತೆಗೆದುಕೊಳ್ಳಬೇಕೇ?",
            "{place} ನಲ್ಲಿ ಸಂಜೆಯ ನಡಿಗೆಗೆ ತುಂಬಾ ಬಿಸಿಯಾಗುತ್ತದೆಯೇ?",
            "{place} ಗೆ ಯಾವುದೇ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ ಇದೆಯೇ?",
        ],
        UserRole.FARMER: [
            "ನಾಳೆ {place} ಹತ್ತಿರ ನೀರಾವರಿ ಮಾಡಬೇಕೇ?",
            "{place} ನಲ್ಲಿ ಕೀಟನಾಶಕ ಸಿಂಪಡಿಸಲು ಮುಂದಿನ ಸುರಕ್ಷಿತ ಸಮಯ ಯಾವುದು?",
            "ಈ ವಾರ {place} ನಲ್ಲಿ ಭಾರೀ ಮಳೆ ಕೊಯ್ಲು ಮಾಡಿದ ಬೆಳೆಗೆ ಹಾನಿ ಮಾಡಬಹುದೇ?",
        ],
    },
}

_MISSING_PROMPTS: dict[str, dict[str, str]] = {
    "en": {
        "crop_type": "Which crop are you growing near {place}?",
        "vessel_type": "What vessel or activity is this for (kayak, fishing boat, cargo)?",
    },
    "hi": {
        "crop_type": "आप {place} के पास कौन सी फसल उगा रहे हैं?",
        "vessel_type": "यह किस प्रकार की नाव या गतिविधि के लिए है (कयाक, मछली पकड़ने की नाव, कार्गो)?",
    },
    "ta": {
        "crop_type": "நீங்கள் {place} அருகே எந்தப் பயிர் வளர்க்கிறீர்கள்?",
        "vessel_type": "இது எந்த வகை படகு/செயல்பாடு (கேயாக், மீன்பிடி படகு, சரக்குக் கப்பல்)?",
    },
    "kn": {
        "crop_type": "ನೀವು {place} ಹತ್ತಿರ ಯಾವ ಬೆಳೆ ಬೆಳೆಯುತ್ತಿದ್ದೀರಿ?",
        "vessel_type": "ಇದು ಯಾವ ದೋಣಿ/ಚಟುವಟಿಕೆಗಾಗಿ (ಕಾಯಕ್, ಮೀನುಗಾರಿಕೆ ದೋಣಿ, ಸರಕು ಹಡಗು)?",
    },
}

_PLACE_DEFAULT: dict[str, str] = {
    "en": "your area",
    "hi": "आपके क्षेत्र",
    "ta": "உங்கள் பகுதி",
    "kn": "ನಿಮ್ಮ ಪ್ರದೇಶ",
    "bn": "আপনার এলাকা",
    "te": "మీ ప్రాంతం",
    "mr": "तुमचा परिसर",
    "gu": "તમારો વિસ્તાર",
    "ml": "നിങ്ങളുടെ പ്രദേശം",
    "pa": "ਤੁਹਾਡਾ ਖੇਤਰ",
    "or": "ଆପଣଙ୍କ ଅଞ୍ଚଳ",
    "ur": "آپ کا علاقہ",
}

# Canonical English city → native script per language (for follow-ups)
_CITY_I18N: dict[str, dict[str, str]] = {
    "lucknow": {
        "hi": "लखनऊ",
        "mr": "लखनौ",
        "bn": "লখনউ",
        "ta": "லக்னோ",
        "kn": "ಲಕ್ನೋ",
        "te": "లక్నో",
        "gu": "લખનૌ",
        "pa": "ਲਖਨਊ",
        "ml": "ലക്‌നോ",
        "or": "ଲଖନୌ",
        "ur": "لکھنؤ",
    },
    "new delhi": {
        "hi": "नई दिल्ली",
        "bn": "নয়া দিল্লি",
        "ta": "புது தில்லி",
        "kn": "ನವ ದೆಹಲಿ",
        "te": "న్యూ ఢిల్లీ",
        "gu": "ન્યૂ દિલ્હી",
        "pa": "ਨਵੀਂ ਦਿੱਲੀ",
        "mr": "नवी दिल्ली",
        "ml": "ന്യൂ ഡൽഹി",
        "or": "ନୂଆ ଦିଲ୍ଲୀ",
        "ur": "نئی دہلی",
    },
    "delhi": {
        "hi": "दिल्ली",
        "bn": "দিল্লি",
        "ta": "தில்லி",
        "kn": "ದೆಹಲಿ",
        "te": "ఢిల్లీ",
        "gu": "દિલ્હી",
        "pa": "ਦਿੱਲੀ",
        "mr": "दिल्ली",
        "ml": "ഡൽഹി",
        "or": "ଦିଲ୍ଲୀ",
        "ur": "دہلی",
    },
    "mumbai": {
        "hi": "मुंबई",
        "mr": "मुंबई",
        "bn": "মুম্বই",
        "ta": "மும்பை",
        "kn": "ಮುಂಬೈ",
        "te": "ముంబై",
        "gu": "મુંબઈ",
        "pa": "ਮੁੰਬਈ",
        "ml": "മുംബൈ",
        "or": "ମୁମ୍ବାଇ",
        "ur": "ممبئی",
    },
    "bengaluru": {
        "hi": "बेंगलुरु",
        "kn": "ಬೆಂಗಳೂರು",
        "ta": "பெங்களூரு",
        "te": "బెంగళూరు",
        "bn": "বেঙ্গালুরু",
        "mr": "बेंगळुरू",
        "gu": "બેંગલુરુ",
        "pa": "ਬੈਂਗਲੁਰੂ",
        "ml": "ബെംഗളൂരു",
        "or": "ବେଙ୍ଗାଲୁରୁ",
        "ur": "بنگلورو",
    },
    "bangalore": {
        "hi": "बेंगलुरु",
        "kn": "ಬೆಂಗಳೂರು",
        "ta": "பெங்களூரு",
        "te": "బెంగళూరు",
    },
    "chennai": {
        "hi": "चेन्नई",
        "ta": "சென்னை",
        "kn": "ಚೆನ್ನೈ",
        "te": "చెన్నై",
        "bn": "চেন্নাই",
        "mr": "चेन्नई",
        "gu": "ચેન્નઈ",
        "pa": "ਚੇਨਈ",
        "ml": "ചെന്നൈ",
        "or": "ଚେନ୍ନାଇ",
        "ur": "چنئی",
    },
    "kolkata": {
        "hi": "कोलकाता",
        "bn": "কলকাতা",
        "ta": "கொல்கத்தா",
        "kn": "ಕೊಲ್ಕತ್ತಾ",
        "te": "కోల్‌కతా",
        "mr": "कोलकाता",
        "gu": "કોલકાતા",
        "pa": "ਕੋਲਕਾਤਾ",
        "ml": "കൊൽക്കത്ത",
        "or": "କଲିକତା",
        "ur": "کلکتہ",
    },
    "hyderabad": {
        "hi": "हैदराबाद",
        "te": "హైదరాబాద్",
        "ta": "ஹைதராபாத்",
        "kn": "ಹೈದರಾಬಾದ್",
        "bn": "হায়দ্রাবাদ",
        "mr": "हैदराबाद",
        "gu": "હૈદરાબાદ",
        "pa": "ਹੈਦਰਾਬਾਦ",
        "ml": "ഹൈദരാബാദ്",
        "or": "ହାଇଦ୍ରାବାଦ",
        "ur": "حیدرآباد",
    },
    "pune": {
        "hi": "पुणे",
        "mr": "पुणे",
        "bn": "পুণে",
        "ta": "புனே",
        "kn": "ಪುಣೆ",
        "te": "పూణే",
        "gu": "પુણે",
        "pa": "ਪੁਣੇ",
        "ml": "പൂനെ",
        "or": "ପୁଣେ",
        "ur": "پونے",
    },
    "jaipur": {"hi": "जयपुर", "bn": "জয়পুর", "ta": "ஜெய்ப்பூர்", "kn": "ಜೈಪುರ", "gu": "જયપુર"},
    "ahmedabad": {"hi": "अहमदाबाद", "gu": "અમદાવાદ", "bn": "আহমেদাবাদ"},
    "chandigarh": {"hi": "चंडीगढ़", "pa": "ਚੰਡੀਗੜ੍ਹ"},
    "patna": {"hi": "पटना", "bn": "পাটনা"},
    "kanpur": {"hi": "कानपुर"},
    "varanasi": {"hi": "वाराणसी"},
    "agra": {"hi": "आगरा"},
}


def localize_place_name(location_name: Optional[str], language: str) -> str:
    """Return city name in the reply language script when known."""
    lang = (language or "en").lower()
    if not location_name or not location_name.strip():
        return _PLACE_DEFAULT.get(lang, _PLACE_DEFAULT["en"])
    if lang == "en":
        return location_name
    key = location_name.lower().strip()
    # strip common suffixes from geocoder ("Lucknow, Uttar Pradesh, India")
    key = key.split(",")[0].strip()
    city_map = _CITY_I18N.get(key)
    if city_map and lang in city_map:
        return city_map[lang]
    # Already in Indic script — keep as-is
    if any(ord(ch) > 0x007F for ch in location_name):
        return location_name.split(",")[0].strip()
    return location_name.split(",")[0].strip()


def missing_info_follow_up(key: str, language: str, location_name: Optional[str]) -> str:
    place = localize_place_name(location_name, language)
    table = _MISSING_PROMPTS.get(language) or _MISSING_PROMPTS["en"]
    template = table.get(key) or _MISSING_PROMPTS["en"].get(key, key)
    text = template.format(place=place)
    if language not in _MISSING_PROMPTS and language != "en":
        return _translate_lines([text], language)[0]
    return text


def suggest_follow_ups(
    intent: str,
    language: str = "en",
    location_name: Optional[str] = None,
    role: Optional[str] = None,
) -> list[str]:
    lang = (language or "en").lower()
    place = localize_place_name(location_name, lang)
    user_role = normalize_role(role)

    localized_roles = _ROLE_FOLLOW_UPS_I18N.get(lang) or {}
    templates = localized_roles.get(user_role)
    if not templates:
        templates = ROLE_FOLLOW_UPS.get(user_role) or INTENT_FOLLOW_UPS.get(
            intent, INTENT_FOLLOW_UPS["forecast"]
        )
        questions = [t.format(place=place) for t in templates[:3]]
        if lang != "en":
            return _translate_lines(questions, lang)
        return questions

    return [t.format(place=place) for t in templates[:3]]


def _translate_lines(lines: list[str], language: str) -> list[str]:
    """Best-effort Gemini translation so any supported Indian language can match the prompt."""
    if not lines or language == "en":
        return lines
    name = language_display_name(language)
    numbered = "\n".join(f"{i + 1}. {line}" for i, line in enumerate(lines))
    prompt = (
        f"Translate each numbered line into {name} ({language}). "
        "Keep the same meaning as weather follow-up questions. "
        "Return ONLY the translations as a numbered list 1..N with no extra commentary.\n\n"
        f"{numbered}"
    )
    try:
        # Lazy import to avoid circular dependency with gemini.py
        from app.services.gemini import ask_gemini

        raw = ask_gemini(prompt) or ""
        out: list[str] = []
        for line in raw.splitlines():
            clean = line.strip()
            if not clean:
                continue
            # strip "1." / "1)" prefixes
            for sep in (". ", ") ", " - ", "— "):
                if clean[:2].isdigit() or (len(clean) > 2 and clean[0].isdigit()):
                    parts = clean.split(sep, 1)
                    if len(parts) == 2 and parts[0].strip().rstrip(".").isdigit():
                        clean = parts[1].strip()
                        break
            out.append(clean.strip(" \"'"))
        if len(out) >= len(lines):
            return out[: len(lines)]
    except Exception:
        pass
    return lines
