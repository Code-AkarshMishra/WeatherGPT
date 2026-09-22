import sys
from pathlib import Path

# Allow `python scripts/test_gemini.py` from the project root.
project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.services.gemini import ask_gemini

reply = ask_gemini("Reply with exactly one short sentence: WeatherGPT is connected.")
print(reply)
