"""
disaster_predictor.py
MoES & IMD Severe-Weather Disaster Risk Predictor.

Trained Random Forest Classifier on 240 labeled samples derived from
IMD severe weather classification thresholds and historical event profiles.

Features: [rainfall_mm, wind_speed_kmph, temperature_c]
Labels:   0=GREEN, 1=YELLOW, 2=ORANGE, 3=RED (IMD 4-tier color code)

Produces:
- IMD Color-Coded Alert (GREEN, YELLOW, ORANGE, RED)
- Severe-Weather Risk Assessment (Low, Moderate, High, Critical Disaster)
- Dual-language Farmer Advisory (Hindi + English)
- Dual-language Marine Advisory (Hindi + English)
- Action Points & Spoken Alert Script
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, classification_report
import os
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# ─── Training Dataset ─────────────────────────────────────────────────────────
# 240 labeled samples based on IMD severe weather classification criteria:
#   GREEN  (0): Rain < 15.6mm, Wind < 25 km/h, Temp 8-36°C
#   YELLOW (1): Rain 15.6-64.4mm, Wind 25-44 km/h, Temp 37-39°C or 5-7°C
#   ORANGE (2): Rain 64.5-115.5mm, Wind 45-74 km/h, Temp 40-43°C or 3-4°C
#   RED    (3): Rain >= 115.6mm, Wind >= 75 km/h, Temp >= 44°C or <= 2°C
#
# Samples include boundary cases, mixed-severity scenarios (e.g. moderate rain
# + extreme wind), monsoon profiles, cyclone profiles, heatwave/coldwave events,
# and normal conditions across India's climate range.

def _generate_training_data():
    """Generate 240 labeled training samples from IMD meteorological thresholds."""
    np.random.seed(42)
    X, y = [], []

    # ── GREEN (60 samples) ─────────────────────────────────────────────────
    # Normal conditions: light/no rain, calm winds, comfortable temperatures
    for _ in range(15):
        X.append([np.random.uniform(0, 2), np.random.uniform(0, 10), np.random.uniform(20, 32)])
        y.append(0)
    for _ in range(15):
        X.append([np.random.uniform(0, 5), np.random.uniform(5, 15), np.random.uniform(15, 35)])
        y.append(0)
    for _ in range(10):
        X.append([np.random.uniform(2, 10), np.random.uniform(10, 20), np.random.uniform(22, 30)])
        y.append(0)
    for _ in range(10):
        X.append([0, np.random.uniform(0, 8), np.random.uniform(25, 36)])
        y.append(0)
    # Winter normal (cold but safe)
    for _ in range(5):
        X.append([np.random.uniform(0, 5), np.random.uniform(0, 12), np.random.uniform(8, 15)])
        y.append(0)
    # Hot but safe
    for _ in range(5):
        X.append([0, np.random.uniform(5, 15), np.random.uniform(33, 36)])
        y.append(0)

    # ── YELLOW (60 samples) ─────────────────────────────────────────────────
    # Moderate rain events
    for _ in range(12):
        X.append([np.random.uniform(15.6, 35), np.random.uniform(10, 25), np.random.uniform(20, 30)])
        y.append(1)
    for _ in range(10):
        X.append([np.random.uniform(25, 50), np.random.uniform(15, 30), np.random.uniform(22, 28)])
        y.append(1)
    # Gusty wind events
    for _ in range(10):
        X.append([np.random.uniform(5, 20), np.random.uniform(25, 40), np.random.uniform(22, 30)])
        y.append(1)
    # Moderate rain + moderate wind combo
    for _ in range(8):
        X.append([np.random.uniform(20, 45), np.random.uniform(25, 38), np.random.uniform(23, 28)])
        y.append(1)
    # Mild heat discomfort
    for _ in range(8):
        X.append([np.random.uniform(0, 10), np.random.uniform(8, 20), np.random.uniform(37, 39.5)])
        y.append(1)
    # Mild cold discomfort
    for _ in range(6):
        X.append([np.random.uniform(0, 8), np.random.uniform(5, 18), np.random.uniform(5, 7.5)])
        y.append(1)
    # Light rain + gusty wind
    for _ in range(6):
        X.append([np.random.uniform(10, 25), np.random.uniform(28, 42), np.random.uniform(24, 30)])
        y.append(1)

    # ── ORANGE (60 samples) ─────────────────────────────────────────────────
    # Heavy rainfall events
    for _ in range(12):
        X.append([np.random.uniform(64.5, 100), np.random.uniform(20, 45), np.random.uniform(20, 27)])
        y.append(2)
    for _ in range(8):
        X.append([np.random.uniform(75, 115), np.random.uniform(30, 55), np.random.uniform(21, 26)])
        y.append(2)
    # Strong squall / wind events
    for _ in range(10):
        X.append([np.random.uniform(15, 50), np.random.uniform(45, 70), np.random.uniform(22, 28)])
        y.append(2)
    # Heavy rain + strong wind (pre-cyclone)
    for _ in range(8):
        X.append([np.random.uniform(65, 110), np.random.uniform(45, 65), np.random.uniform(22, 27)])
        y.append(2)
    # Heatwave conditions
    for _ in range(8):
        X.append([np.random.uniform(0, 5), np.random.uniform(8, 25), np.random.uniform(40, 43.5)])
        y.append(2)
    # Severe cold wave / frost
    for _ in range(6):
        X.append([np.random.uniform(0, 10), np.random.uniform(5, 15), np.random.uniform(2.5, 4.5)])
        y.append(2)
    # Moderate rain + borderline heatwave
    for _ in range(4):
        X.append([np.random.uniform(30, 60), np.random.uniform(20, 35), np.random.uniform(39, 42)])
        y.append(2)
    # Moderate rain + strong wind
    for _ in range(4):
        X.append([np.random.uniform(40, 70), np.random.uniform(50, 70), np.random.uniform(23, 27)])
        y.append(2)

    # ── RED (60 samples) ─────────────────────────────────────────────────
    # Extremely heavy rainfall (cloudburst / depression)
    for _ in range(12):
        X.append([np.random.uniform(115.6, 200), np.random.uniform(30, 70), np.random.uniform(19, 25)])
        y.append(3)
    for _ in range(8):
        X.append([np.random.uniform(150, 300), np.random.uniform(50, 100), np.random.uniform(18, 24)])
        y.append(3)
    # Cyclonic gale winds
    for _ in range(10):
        X.append([np.random.uniform(40, 120), np.random.uniform(75, 150), np.random.uniform(20, 27)])
        y.append(3)
    # Severe cyclone (extreme rain + extreme wind)
    for _ in range(8):
        X.append([np.random.uniform(120, 250), np.random.uniform(80, 160), np.random.uniform(20, 26)])
        y.append(3)
    # Extreme heatwave
    for _ in range(8):
        X.append([np.random.uniform(0, 3), np.random.uniform(5, 25), np.random.uniform(44, 50)])
        y.append(3)
    # Extreme cold wave / severe frost
    for _ in range(6):
        X.append([np.random.uniform(0, 10), np.random.uniform(0, 15), np.random.uniform(-5, 2)])
        y.append(3)
    # Cloudburst + flash flood
    for _ in range(4):
        X.append([np.random.uniform(200, 400), np.random.uniform(40, 80), np.random.uniform(18, 23)])
        y.append(3)
    # Extreme wind alone (tornado / severe storm)
    for _ in range(4):
        X.append([np.random.uniform(20, 60), np.random.uniform(100, 180), np.random.uniform(22, 28)])
        y.append(3)

    return np.array(X), np.array(y)


class MoESDisasterPredictor:
    """
    IMD MoES Severe-Weather Random Forest Classifier.

    Trained on 240 meteorological event samples aligned with IMD's
    4-tier color-coded warning system. Features: rainfall (mm),
    wind speed (km/h), temperature (C).

    Model performance is evaluated on a 20% stratified hold-out test set
    and metrics are logged at initialization.
    """

    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            min_samples_split=4,
            min_samples_leaf=2,
            class_weight='balanced',
            random_state=42
        )
        self.metrics = {}
        self._train_and_evaluate()
        self._build_alert_map()

    def _train_and_evaluate(self):
        """Train on 240 samples and evaluate on stratified hold-out split."""
        X, y = _generate_training_data()

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        self.model.fit(X_train, y_train)

        # Evaluate
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        f1_macro = f1_score(y_test, y_pred, average='macro')
        f1_per_class = f1_score(y_test, y_pred, average=None)

        self.metrics = {
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "accuracy": round(accuracy, 4),
            "f1_macro": round(f1_macro, 4),
            "f1_per_class": {
                "GREEN": round(float(f1_per_class[0]), 4),
                "YELLOW": round(float(f1_per_class[1]), 4),
                "ORANGE": round(float(f1_per_class[2]), 4),
                "RED": round(float(f1_per_class[3]), 4),
            },
            "feature_importances": {
                "rainfall_mm": round(float(self.model.feature_importances_[0]), 4),
                "wind_speed_kmph": round(float(self.model.feature_importances_[1]), 4),
                "temperature_c": round(float(self.model.feature_importances_[2]), 4),
            }
        }

        report = classification_report(y_test, y_pred,
            target_names=["GREEN", "YELLOW", "ORANGE", "RED"])

        logger.info(f"MoES Disaster Predictor Initialized -- "
                     f"Accuracy: {accuracy:.2%} | F1 (macro): {f1_macro:.2%}")
        logger.info(f"Feature Importances: Rain={self.model.feature_importances_[0]:.3f}, "
                     f"Wind={self.model.feature_importances_[1]:.3f}, "
                     f"Temp={self.model.feature_importances_[2]:.3f}")
        logger.info(f"\n{report}")

        print(f"[ML] MoES Disaster Predictor: {len(X_train)} train / {len(X_test)} test | "
              f"Accuracy: {accuracy:.2%} | F1: {f1_macro:.2%}")

    def _build_alert_map(self):
        """IMD-aligned alert specifications with bilingual advisories."""
        self.alert_map = {
            0: {
                "color": "GREEN",
                "risk": "Low",
                "status_text": "No Warning / All Clear",
                "status_text_hi": "\u0915\u094b\u0908 \u091a\u0947\u0924\u093e\u0935\u0928\u0940 \u0928\u0939\u0940\u0902 / \u0938\u093e\u092e\u093e\u0928\u094d\u092f",
                "farmer": {
                    "hi": "\u092e\u094c\u0938\u092e \u0905\u0928\u0941\u0915\u0942\u0932 \u0939\u0948\u0964 \u091c\u0941\u0924\u093e\u0908, \u092c\u0941\u0935\u093e\u0908 \u0914\u0930 \u0938\u093e\u092e\u093e\u0928\u094d\u092f \u0916\u093e\u0926 \u0921\u093e\u0932\u0928\u0947 \u0915\u093e \u0915\u093e\u0930\u094d\u092f \u0938\u0941\u091a\u093e\u0930\u0942 \u0930\u0942\u092a \u0938\u0947 \u0915\u0930\u0947\u0902\u0964",
                    "en": "Favorable weather conditions. Suitable for normal farming, tilling, and fertilizer application."
                },
                "marine": {
                    "hi": "\u0938\u092e\u0941\u0926\u094d\u0930 \u0936\u093e\u0902\u0924 \u0939\u0948\u0964 \u0938\u093e\u092e\u093e\u0928\u094d\u092f \u092e\u091b\u0932\u0940 \u092a\u0915\u0921\u093c\u0928\u0947 \u0914\u0930 \u0924\u091f\u0940\u092f \u0928\u094c\u0915\u093e\u092f\u0928 \u0915\u0947 \u0932\u093f\u090f \u092a\u0930\u093f\u0938\u094d\u0925\u093f\u0924\u093f\u092f\u093e\u0902 \u0905\u0928\u0941\u0915\u0942\u0932 \u0939\u0948\u0902\u0964",
                    "en": "Sea state calm to slight. Safe for fishing operations and coastal navigation."
                },
                "actions": [
                    "Routine agricultural and outdoor activities can continue unhindered.",
                    "Standard moisture conservation is recommended."
                ]
            },
            1: {
                "color": "YELLOW",
                "risk": "Moderate",
                "status_text": "Watch / Be Updated",
                "status_text_hi": "\u0905\u092a\u0921\u0947\u091f \u0930\u0939\u0947\u0902 / \u0928\u093f\u0917\u0930\u093e\u0928\u0940 \u0930\u0916\u0947\u0902",
                "farmer": {
                    "hi": "\u0939\u0932\u094d\u0915\u0940 \u0906\u0902\u0927\u0940 \u0914\u0930 \u092c\u093e\u0930\u093f\u0936 \u0915\u0940 \u0938\u0902\u092d\u093e\u0935\u0928\u093e\u0964 \u0916\u0947\u0924\u094b\u0902 \u092e\u0947\u0902 \u091c\u0932-\u0928\u093f\u0915\u093e\u0938\u0940 \u0915\u0940 \u0935\u094d\u092f\u0935\u0938\u094d\u0925\u093e \u0930\u0916\u0947\u0902 \u0914\u0930 \u0916\u0941\u0932\u0947 \u092e\u0947\u0902 \u0915\u091f\u0940 \u092b\u0938\u0932 \u0928 \u091b\u094b\u0921\u093c\u0947\u0902\u0964",
                    "en": "Scattered showers and gusty winds expected. Ensure field drainage channels are clear and cover harvested produce."
                },
                "marine": {
                    "hi": "\u0939\u0935\u093e \u0915\u0940 \u0917\u0924\u093f 25-40 \u0915\u093f\u092e\u0940/\u0918\u0902\u091f\u093e \u0938\u0902\u092d\u0935\u0964 \u092e\u091b\u0941\u0906\u0930\u0947 \u0924\u091f \u0915\u0947 \u0928\u093f\u0915\u091f \u0938\u093e\u0935\u0927\u093e\u0928\u0940 \u0938\u0947 \u0928\u094c\u0915\u093e\u092f\u0928 \u0915\u0930\u0947\u0902\u0964",
                    "en": "Wind speed 25-40 km/h with moderate sea chop. Fishermen advised to exercise caution near shoreline."
                },
                "actions": [
                    "Keep umbrellas or rain protection handy.",
                    "Inspect drainage near low-lying property.",
                    "Monitor local weather updates before distant travel."
                ]
            },
            2: {
                "color": "ORANGE",
                "risk": "High",
                "status_text": "Alert / Be Prepared",
                "status_text_hi": "\u0938\u0924\u0930\u094d\u0915 \u0930\u0939\u0947\u0902 / \u0924\u0948\u092f\u093e\u0930 \u0930\u0939\u0947\u0902",
                "farmer": {
                    "hi": "\u092d\u093e\u0930\u0940 \u092c\u093e\u0930\u093f\u0936 \u0914\u0930 45+ \u0915\u093f\u092e\u0940/\u0918\u0902\u091f\u093e \u0924\u0947\u091c\u093c \u0939\u0935\u093e \u0915\u0940 \u091a\u0947\u0924\u093e\u0935\u0928\u0940! \u0915\u0940\u091f\u0928\u093e\u0936\u0915 \u091b\u093f\u0921\u093c\u0915\u093e\u0935 \u0914\u0930 \u0938\u093f\u0902\u091a\u093e\u0908 \u0924\u0941\u0930\u0902\u0924 \u0930\u094b\u0915\u0947\u0902, \u0915\u091f\u0940 \u092b\u0938\u0932 \u0938\u0941\u0930\u0915\u094d\u0937\u093f\u0924 \u0917\u094b\u0926\u093e\u092e \u092e\u0947\u0902 \u0930\u0916\u0947\u0902\u0964",
                    "en": "Heavy rainfall and 45+ km/h squall alert! Suspend pesticide spraying and irrigation immediately; store produce in covered shelters."
                },
                "marine": {
                    "hi": "\u0938\u092e\u0941\u0926\u094d\u0930 \u0905\u0936\u093e\u0902\u0924 (45-65 \u0915\u093f\u092e\u0940/\u0918\u0902\u091f\u093e \u0924\u0947\u091c\u093c \u0939\u0935\u093e)\u0964 \u092e\u091b\u0941\u0906\u0930\u0947 \u0917\u0939\u0930\u0947 \u0938\u092e\u0941\u0926\u094d\u0930 \u092e\u0947\u0902 \u092c\u093f\u0932\u094d\u0915\u0941\u0932 \u0928 \u091c\u093e\u090f\u0902, \u0928\u094c\u0915\u093e\u090f\u0902 \u0938\u0941\u0930\u0915\u094d\u0937\u093f\u0924 \u092c\u093e\u0902\u0927\u0947\u0902\u0964",
                    "en": "Rough sea conditions with squalls up to 65 km/h. Fishermen strictly advised NOT to venture into deep sea. Secure coastal boats."
                },
                "actions": [
                    "Avoid unnecessary outdoor travel during squalls.",
                    "Stay away from weak structures, tin sheds, and electric poles.",
                    "Charge emergency lights and secure loose rooftop items."
                ]
            },
            3: {
                "color": "RED",
                "risk": "Critical Disaster",
                "status_text": "Warning / Take Action",
                "status_text_hi": "\u0924\u0942\u092b\u093e\u0928 \u091a\u0947\u0924\u093e\u0935\u0928\u0940 / \u0924\u0924\u094d\u0915\u093e\u0932 \u0915\u0926\u092e \u0909\u0920\u093e\u090f\u0902",
                "farmer": {
                    "hi": "\u0924\u0942\u092b\u093e\u0928 \u0914\u0930 \u0905\u0924\u093f-\u0935\u0943\u0937\u094d\u091f\u093f \u0915\u093e \u0917\u0902\u092d\u0940\u0930 \u0905\u0932\u0930\u094d\u091f! \u0924\u0941\u0930\u0902\u0924 \u0916\u0947\u0924 \u0916\u093e\u0932\u0940 \u0915\u0930\u0947\u0902, \u092a\u0936\u0941\u0913\u0902 \u0915\u094b \u092a\u0915\u094d\u0915\u0947 \u092c\u093e\u0921\u093c\u094b\u0902 \u092e\u0947\u0902 \u0938\u0941\u0930\u0915\u094d\u0937\u093f\u0924 \u092c\u093e\u0902\u0927\u0947\u0902, \u0915\u094b\u0908 \u0915\u0943\u0937\u093f \u0915\u093e\u0930\u094d\u092f \u0928 \u0915\u0930\u0947\u0902!",
                    "en": "SEVERE DISASTER / STORM ALERT! Evacuate open fields immediately, secure livestock in reinforced sheds, cease all agricultural operations!"
                },
                "marine": {
                    "hi": "\u0917\u0902\u092d\u0940\u0930 \u0938\u092e\u0941\u0926\u094d\u0930\u0940 \u091a\u0915\u094d\u0930\u0935\u093e\u0924/\u0924\u0942\u092b\u093e\u0928 \u091a\u0947\u0924\u093e\u0935\u0928\u0940! \u0938\u092d\u0940 \u0938\u092e\u0941\u0926\u094d\u0930\u0940 \u0917\u0924\u093f\u0935\u093f\u0927\u093f\u092f\u093e\u0902 \u092a\u0942\u0930\u094d\u0923\u0924\u0903 \u0938\u094d\u0925\u0917\u093f\u0924\u0964 \u0924\u0924\u094d\u0915\u093e\u0932 \u0938\u0941\u0930\u0915\u094d\u0937\u093f\u0924 \u0906\u0936\u094d\u0930\u092f \u0932\u0947\u0902\u0964",
                    "en": "CRITICAL MARINE WARNING / GALE CONDITIONS (>75 km/h). Complete suspension of all fishing and harbor activities. Seek immediate high-ground shelter."
                },
                "actions": [
                    "Evacuate low-lying flood-prone zones if instructed by authorities.",
                    "Stock emergency drinking water, dry rations, and first aid kits.",
                    "Do not step out during peak gale or torrential downpour."
                ]
            }
        }

    def predict(self, rain_mm: float, wind_kmph: float, temp_c: float, city: str = "Your Area") -> Dict[str, Any]:
        """
        Run Random Forest prediction and return MoES IMD warning payload.
        """
        rain = max(0, float(rain_mm) if rain_mm else 0)
        wind = max(0, float(wind_kmph) if wind_kmph else 0)
        temp = float(temp_c) if temp_c else 25.0

        features = np.array([[rain, wind, temp]])
        pred_tier = int(self.model.predict(features)[0])

        # Model confidence (probability of predicted class)
        probabilities = self.model.predict_proba(features)[0]
        confidence = round(float(probabilities[pred_tier]) * 100, 1)

        info = self.alert_map[pred_tier]
        color = info["color"]
        risk = info["risk"]

        spoken_hi = f"\u0938\u0924\u0930\u094d\u0915 \u0930\u0939\u0947\u0902\u0964 {city} \u0915\u0947 \u0932\u093f\u090f \u092e\u094c\u0938\u092e \u0935\u093f\u092d\u093e\u0917 \u0915\u093e {color} \u0905\u0932\u0930\u094d\u091f\u0964 {info['farmer']['hi']}"
        spoken_en = f"IMD {color} Alert for {city}. Severe weather risk: {risk}. {info['farmer']['en']}"

        return {
            "city": city,
            "rain_mm": rain,
            "wind_kmph": wind,
            "temp_c": temp,
            "imd_color_code": color,
            "risk_assessment": risk,
            "confidence_pct": confidence,
            "status_text": info["status_text"],
            "status_text_hi": info["status_text_hi"],
            "farmer_advisory": info["farmer"],
            "marine_advisory": info["marine"],
            "action_points": info["actions"],
            "spoken_text_hi": spoken_hi,
            "spoken_text_en": spoken_en,
            "audio_file": None
        }

    def get_metrics(self) -> Dict[str, Any]:
        """Return model evaluation metrics."""
        return self.metrics


# Singleton instance
disaster_predictor = MoESDisasterPredictor()
