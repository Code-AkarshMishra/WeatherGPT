import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.services.location import search_location
from app.services.weather import get_forecast

place = search_location("Lucknow")
print("Location:", place)

if not place:
    raise SystemExit("Could not resolve Lucknow")

forecast = get_forecast(place["latitude"], place["longitude"], days=3)
print("Forecast days:", forecast["forecast_days"])
print("Daily:")
for day in forecast["daily"]:
    print(day)

print("Hourly sample (first 3):")
for hour in forecast["hourly_next_24h"][:3]:
    print(hour)