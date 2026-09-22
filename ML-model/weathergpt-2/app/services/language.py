"""
Detect reply language for Indian multilingual chat.

Strategy (no external API key required):
1. Count letters by Unicode script (Latin + Indic scripts).
2. Whatever language/script covers >= 70% of letters becomes the reply language.
3. If no script reaches 70%, use the single largest share (plurality).

Devanagari is shared by Hindi and Marathi; Marathi-specific letters tip toward `mr`.
"""
from __future__ import annotations

from collections import Counter
from typing import Optional

# Align with backend SUPPORTED_LANGUAGES
SUPPORTED_LANGUAGE_CODES = (
    "en",
    "hi",
    "bn",
    "te",
    "mr",
    "ta",
    "ur",
    "gu",
    "kn",
    "ml",
    "pa",
    "or",
)

LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "te": "Telugu",
    "mr": "Marathi",
    "ta": "Tamil",
    "ur": "Urdu",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "or": "Odia",
}

# Any language covering this share of letter characters wins the reply language
MAJORITY_THRESHOLD = 0.70

# Marathi-leaning Devanagari letters (rare/absent in standard Hindi text)
_MARATHI_MARKERS = set("ळऱऍऑॆॊ")


def _script_bucket(code: int) -> Optional[str]:
    """Map a Unicode code point to a language/script bucket key."""
    if (
        0x0041 <= code <= 0x005A
        or 0x0061 <= code <= 0x007A
        or 0x00C0 <= code <= 0x024F
    ):
        return "latin"
    if 0x0900 <= code <= 0x097F:
        return "devanagari"
    if 0x0980 <= code <= 0x09FF:
        return "bn"
    if 0x0A00 <= code <= 0x0A7F:
        return "pa"
    if 0x0A80 <= code <= 0x0AFF:
        return "gu"
    if 0x0B00 <= code <= 0x0B7F:
        return "or"
    if 0x0B80 <= code <= 0x0BFF:
        return "ta"
    if 0x0C00 <= code <= 0x0C7F:
        return "te"
    if 0x0C80 <= code <= 0x0CFF:
        return "kn"
    if 0x0D00 <= code <= 0x0D7F:
        return "ml"
    if 0x0600 <= code <= 0x06FF or 0x0750 <= code <= 0x077F:
        return "ur"
    return None


def _bucket_to_language(bucket: str, text: str) -> str:
    if bucket == "latin":
        return "en"
    if bucket == "devanagari":
        return _resolve_devanagari(text)
    if bucket in LANGUAGE_NAMES:
        return bucket
    return "en"


def _resolve_devanagari(text: str) -> str:
    if any(ch in _MARATHI_MARKERS for ch in text):
        return "mr"
    return "hi"


def detect_language(text: str) -> str:
    """
    Detect reply language code.

    Returns one of SUPPORTED_LANGUAGE_CODES (default ``en``).
    For mixed prompts, the language whose script covers >= 70% of letters wins.
    If none reach 70%, the largest script share wins.
    """
    if not text or not text.strip():
        return "en"

    counts: Counter[str] = Counter()
    for ch in text:
        bucket = _script_bucket(ord(ch))
        if bucket:
            counts[bucket] += 1

    total = sum(counts.values())
    if total == 0:
        return "en"

    # Prefer any script that covers >= 70%; otherwise take the plurality
    majority = [
        (bucket, share)
        for bucket, count in counts.items()
        if (share := count / total) >= MAJORITY_THRESHOLD
    ]
    if majority:
        winner, _ = max(majority, key=lambda item: item[1])
    else:
        winner, _ = max(counts.items(), key=lambda item: item[1])

    return _bucket_to_language(winner, text)


def language_display_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code, "English")
