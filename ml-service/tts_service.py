"""
tts_service.py
Consolidated Regional Voice Synthesis Service (ML-2).
Generates neural spoken Hindi and Indian English audio alerts using edge-tts.
"""

import os
import asyncio
from typing import Optional

AUDIO_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "audio_cache")
os.makedirs(AUDIO_OUTPUT_DIR, exist_ok=True)

async def synthesize_speech(text: str, filename: str, voice: str = "hi-IN-SwaraNeural") -> Optional[str]:
    """
    Synthesizes speech to an MP3 file using edge-tts.
    """
    try:
        import edge_tts
        filepath = os.path.join(AUDIO_OUTPUT_DIR, filename)
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(filepath)
        return filepath
    except Exception as e:
        print(f"[TTS] Speech synthesis error: {e}")
        return None

def generate_alert_audio(text: str, city: str = "alert") -> Optional[str]:
    """Synchronous wrapper for generating speech alert file."""
    safe_city = city.lower().replace(" ", "_").replace("/", "_")
    filename = f"audio_{safe_city}.mp3"
    try:
        return asyncio.run(synthesize_speech(text, filename))
    except Exception as e:
        print(f"[TTS] Failed to run asyncio TTS: {e}")
        return None
