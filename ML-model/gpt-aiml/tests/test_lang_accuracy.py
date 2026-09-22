import sys
import os
sys.path.insert(0, os.path.abspath("."))
sys.stdout.reconfigure(encoding='utf-8')
from app.agent.entities import EntityExtractor

test_cases = [
    ("What is the weather today in Delhi?", "en"),
    ("Tell me the current weather forecast for Mumbai", "en"),
    ("Is it going to rain tomorrow in Chennai?", "en"),
    ("03 july 2004 ka weather batao", "hinglish"),
    ("Lucknow me aaj barish hogi kya?", "hinglish"),
    ("kaisa mausam hai abhi", "hinglish"),
    ("दिल्ली में आज का तापमान क्या है?", "hi"),
    ("क्या कल बारिश होगी?", "hi"),
]

all_passed = True
for q, expected in test_cases:
    ent = EntityExtractor.extract(q)
    passed = ent.language == expected
    print(f'Query: "{q}" -> Detected: {ent.language} (Expected: {expected}) -> {"PASS" if passed else "FAIL"}')
    if not passed:
        all_passed = False

print(f"\nOVERALL RESULT: {'ALL TESTS PASSED' if all_passed else 'FAILED'}")
