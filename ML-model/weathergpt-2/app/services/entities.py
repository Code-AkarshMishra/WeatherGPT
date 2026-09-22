"""Extract place names and forecast horizon from user messages."""
import re
from typing import Optional

# Major Indian cities → geocoding search term
KNOWN_CITIES: dict[str, str] = {
    "lucknow": "Lucknow",
    "लखनऊ": "Lucknow",
    "delhi": "New Delhi",
    "new delhi": "New Delhi",
    "noida": "Noida",
    "mumbai": "Mumbai",
    "मुंबई": "Mumbai",
    "bengaluru": "Bengaluru",
    "bangalore": "Bengaluru",
    "chennai": "Chennai",
    "kolkata": "Kolkata",
    "hyderabad": "Hyderabad",
    "pune": "Pune",
    "jaipur": "Jaipur",
    "ahmedabad": "Ahmedabad",
    "guwahati": "Guwahati",
    "shimla": "Shimla",
    "chandigarh": "Chandigarh",
    "patna": "Patna",
    "bhopal": "Bhopal",
    "indore": "Indore",
    "nagpur": "Nagpur",
    "surat": "Surat",
    "kanpur": "Kanpur",
    "varanasi": "Varanasi",
    "agra": "Agra",
    "dehradun": "Dehradun",
    "srinagar": "Srinagar",
    "kochi": "Kochi",
    "thiruvananthapuram": "Thiruvananthapuram",
    "visakhapatnam": "Visakhapatnam",
    "goa": "Goa",
}

# IMD city forecast station codes (subset; extend via mapping API when whitelisted)
IMD_STATION_CODES: dict[str, str] = {
    "lucknow": "42182",
    "new delhi": "42181",
    "delhi": "42181",
    "mumbai": "43003",
    "chennai": "43279",
    "kolkata": "42809",
    "hyderabad": "43128",
    "bengaluru": "43295",
    "pune": "43063",
    "jaipur": "42397",
    "ahmedabad": "42647",
    "guwahati": "42498",
}


def extract_place_name(text: str) -> Optional[str]:
    """Return a canonical city name if found in the user message."""
    names = extract_place_names(text)
    return names[0] if names else None


def extract_place_names(text: str) -> list[str]:
    """All known cities mentioned, longest names first, unique, original order."""
    clean = (text or "").lower()
    if not clean:
        return []
    found: list[str] = []
    for key in sorted(KNOWN_CITIES.keys(), key=len, reverse=True):
        if re.search(rf"\b{re.escape(key)}\b", clean):
            name = KNOWN_CITIES[key]
            if name not in found and not any(name != existing and name in existing for existing in found):
                found.append(name)
    return found


def imd_station_code(city_name: Optional[str]) -> Optional[str]:
    if not city_name:
        return None
    return IMD_STATION_CODES.get(city_name.lower().strip())


def parse_forecast_days(text: str, default: int = 3) -> int:
    """Parse requested forecast horizon (1–7 days)."""
    clean = (text or "").lower()
    match = re.search(r"\bnext\s+(\d+)\s+days?\b", clean)
    if match:
        return max(1, min(int(match.group(1)), 7))
    if re.search(r"\b7\s*days?\b|\bweek\b|\bnext\s+week\b", clean):
        return 7
    if re.search(r"\b3\s*days?\b", clean):
        return 3
    if re.search(r"\btomorrow\b|\bकल\b|\bparson\b|\bपरसों\b", clean):
        return 2
    return default
