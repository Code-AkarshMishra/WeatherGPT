"""
Multilingual /chat smoke checks without typing Indic scripts in PowerShell.

Usage:
    python scripts/test_multilingual_chat.py
"""
import json
import sys
from pathlib import Path

import httpx

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.services.language import detect_language

OUT_FILE = Path(__file__).resolve().parent / "chat_multilingual_test_output.txt"

CASES = [
    {"name": "english", "message": "What is the weather in Lucknow today?", "expect": "en"},
    {"name": "hindi", "message": "लखनऊ में आज मौसम कैसा है?", "expect": "hi"},
    {"name": "tamil", "message": "சென்னையில் இன்று வானிலை எப்படி?", "expect": "ta"},
    {"name": "kannada", "message": "ಬೆಂಗಳೂರಿನಲ್ಲಿ ಇಂದು ಹವಾಮಾನ ಹೇಗಿದೆ?", "expect": "kn"},
    {
        "name": "mixed_majority_english",
        "message": (
            "Please give me a clear 7 day forecast for Lucknow with daily temperatures "
            "and rain chances. Also थोड़ा बताओ बारिश की"
        ),
        "expect": "en",
    },
]


def main() -> None:
    lines = []
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=60.0) as client:
        for case in CASES:
            message = case["message"]
            detected = detect_language(message)
            response = client.post(
                "/chat",
                json={"message": message, "role": "citizen", "location": {"lat": 26.85, "lon": 80.95, "name": "Lucknow"}},
            )
            data = response.json() if response.status_code == 200 else {"error": response.text}
            lines.extend(
                [
                    f"=== {case['name']} ===",
                    f"expect: {case['expect']}",
                    f"helper: {detected}",
                    f"api_language: {data.get('language')}",
                    f"status: {response.status_code}",
                    f"response: {data.get('response') or data}",
                    "",
                ]
            )
            print(f"[{case['name']}] helper={detected} api={data.get('language')} ok={response.status_code == 200}")

    OUT_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_FILE}")


if __name__ == "__main__":
    main()
