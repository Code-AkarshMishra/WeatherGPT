"""
Test English + Hindi /chat without typing Hindi in PowerShell.

PowerShell consoles often break Devanagari input/display.
This script keeps Hindi in a UTF-8 Python file and prints/saves results safely.
"""

import sys
from pathlib import Path

import httpx

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.services.language import detect_language

BASE_URL = "http://127.0.0.1:8000/chat"
OUT_FILE = Path(__file__).resolve().parent / "chat_language_test_output.txt"

TESTS = [
    {
        "name": "english",
        "message": "Will it rain tomorrow in Lucknow?",
    },
    {
        "name": "hindi",
        # Hindi lives here in UTF-8 source — do not type this in PowerShell.
        "message": "क्या कल लखनऊ में बारिश होगी?",
    },
]


def main() -> None:
    lines: list[str] = []

    with httpx.Client(timeout=60.0) as client:
        for test in TESTS:
            message = test["message"]
            detected = detect_language(message)

            response = client.post(BASE_URL, json={"message": message})
            response.raise_for_status()
            data = response.json()

            block = [
                f"=== {test['name']} ===",
                f"detected_by_helper: {detected}",
                f"api_language: {data.get('language')}",
                f"response: {data.get('response')}",
                "",
            ]
            lines.extend(block)

            # ASCII-only console summary (safe for broken PowerShell fonts)
            print(f"[{test['name']}] helper={detected} api={data.get('language')} ok")

    OUT_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"Full UTF-8 output written to: {OUT_FILE}")


if __name__ == "__main__":
    main()
