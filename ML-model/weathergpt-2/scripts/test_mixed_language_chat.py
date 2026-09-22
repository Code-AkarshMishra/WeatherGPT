import sys
from pathlib import Path

import httpx

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.services.language import detect_language

OUT_FILE = Path(__file__).resolve().parent / "chat_mixed_language_test_output.txt"

TESTS = [
    "Lucknow में कल बारिश होगी क्या?",
    "Will it rain tomorrow in लखनऊ?",
    "लखनऊ का weather tomorrow कैसा रहेगा?",
]


def main() -> None:
    lines: list[str] = []

    with httpx.Client(timeout=60.0) as client:
        for message in TESTS:
            detected = detect_language(message)
            response = client.post(
                "http://127.0.0.1:8000/chat",
                json={"message": message},
            )
            response.raise_for_status()
            data = response.json()

            lines.extend(
                [
                    "=== mixed ===",
                    f"message: {message}",
                    f"detected_by_helper: {detected}",
                    f"api_language: {data.get('language')}",
                    f"response: {data.get('response')}",
                    "",
                ]
            )
            print(
                f"[mixed] helper={detected} api={data.get('language')} ok"
            )

    OUT_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"Full UTF-8 output written to: {OUT_FILE}")


if __name__ == "__main__":
    main()
