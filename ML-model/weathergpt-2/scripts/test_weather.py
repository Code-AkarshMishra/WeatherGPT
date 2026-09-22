import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.services.location import search_location
from app.services.weather import get_current_weather

place = search_location("Lucknow")
print("Location:", place)

if not place:
    raise SystemExit("Could not resolve Lucknow")

weather = get_current_weather(place["latitude"], place["longitude"])
print("Weather:", weather)