"""
Simple terminal chat for WeatherGPT (weathergpt-2).

Usage:
    python scripts/interactive_chat.py
    python scripts/interactive_chat.py --role farmer
"""
import argparse
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")

from app.core.exceptions import GeminiUnavailableError, WeatherGPTError
from app.services.gemini import chat_with_tools
from app.services.language import language_display_name
from app.services.roles import UserRole

ROLES = [r.value for r in UserRole]

_UI_LABELS = {
    "en": {
        "followups": "Suggested follow-up questions:",
        "missing": "Missing information:",
        "indicators": "Role indicators:",
        "metadata": "Response metadata",
        "intent": "Intent",
        "role": "Role",
        "latency": "Latency",
        "confidence": "Confidence",
        "language": "Language",
    },
    "hi": {
        "followups": "सुझाए गए अगले प्रश्न:",
        "missing": "अनुपलब्ध जानकारी:",
        "indicators": "भूमिका संकेतक:",
        "metadata": "प्रतिक्रिया विवरण",
        "intent": "इरादा",
        "role": "भूमिका",
        "latency": "समय",
        "confidence": "विश्वास",
        "language": "भाषा",
    },
}


def _labels(language: str) -> dict[str, str]:
    return _UI_LABELS.get(language) or _UI_LABELS["en"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--role",
        default="citizen",
        choices=ROLES,
        help="User persona (matches MERN UI dropdown)",
    )
    parser.add_argument("--lat", type=float, default=None, help="Simulate client GPS latitude")
    parser.add_argument("--lon", type=float, default=None, help="Simulate client GPS longitude")
    args = parser.parse_args()

    location = None
    if args.lat is not None and args.lon is not None:
        location = {"lat": args.lat, "lon": args.lon}

    print("=" * 60)
    print(" WeatherGPT — Interactive Chat")
    print(f" Role: {args.role}  |  Type 'exit' to quit")
    if location:
        print(f" GPS: {args.lat}, {args.lon}")
    print("=" * 60)

    while True:
        try:
            print()
            question = input("Question: ").strip()
            if not question:
                continue
            if question.lower() in ("exit", "quit", "q", "bye"):
                print("Goodbye.")
                break

            print("Thinking...")
            result = chat_with_tools(question, location=location, role=args.role)

            print()
            print(f"Response: {result['response']}")

            lang = result.get("language") or "en"
            labels = _labels(lang)

            follow_ups = result.get("follow_up_questions") or []
            if follow_ups:
                print()
                print(labels["followups"])
                for item in follow_ups:
                    print(f"  -> {item}")

            risk = result.get("risk")
            if risk and risk.input_variables:
                print()
                print("Risk score inputs (for transparency):")
                for key, val in risk.input_variables.items():
                    if not str(key).startswith("_"):
                        print(f"  {key}: {val}")

            parsed = result.get("parsed_request") or {}
            ctx = result.get("advisory_context") or {}
            missing = ctx.get("missingInformation") or parsed.get("missing_information") or []
            if missing:
                print(f"{labels['missing']} {', '.join(missing)}")
            risks = ctx.get("derivedRisks") or {}
            if risks:
                shown = ", ".join(f"{k}={v}" for k, v in list(risks.items())[:6])
                print(f"{labels['indicators']} {shown}")

            intent = result.get("intent", "general")
            latency = result.get("latency_ms", 0)
            confidence = result.get("confidence", 0.0)
            print()
            print(
                f"{labels['metadata']}: {labels['intent']}={intent} | "
                f"{labels['role']}={result.get('role')} | "
                f"{labels['language']}={lang} ({language_display_name(lang)}) | "
                f"{labels['latency']}={latency}ms | "
                f"{labels['confidence']}={confidence * 100:.1f}%"
            )

        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye.")
            break
        except GeminiUnavailableError as exc:
            print(f"\nError: {exc.message}")
        except WeatherGPTError as exc:
            print(f"\nError: {exc.message}")
        except Exception as exc:
            print(f"\nError: {exc}")


if __name__ == "__main__":
    main()
