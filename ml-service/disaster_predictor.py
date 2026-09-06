"""
disaster_predictor.py
Consolidated MoES Severe-Weather & Disaster Risk Predictor (ML-2).
Trained Random Forest Classifier evaluating rainfall (mm), wind speed (km/h),
and temperature (°C) against IMD MoES warning specifications.

Produces:
- IMD Color-Coded Alert (GREEN, YELLOW, ORANGE, RED)
- Severe-Weather Risk Assessment
- Dual-language Farmer Advisory (Kharif/Rabi, waterlogging, irrigation)
- Dual-language Marine Advisory (Sea state, gale warning, coastal small craft)
- Action Points & Spoken Alert Script
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
import os
import asyncio
from typing import Dict, Any, Optional

class MoESDisasterPredictor:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=50, random_state=42)
        self._train_model()

        self.alert_map = {
            0: {
                "color": "GREEN",
                "risk": "Low",
                "status_text": "No Warning / All Clear",
                "status_text_hi": "कोई चेतावनी नहीं / सामान्य",
                "farmer": {
                    "hi": "मौसम अनुकूल है। जुताई, बुवाई और सामान्य खाद डालने का कार्य सुचारू रूप से करें।",
                    "en": "Favorable weather conditions. Suitable for normal farming, tilling, and fertilizer application."
                },
                "marine": {
                    "hi": "समुद्र शांत है। सामान्य मछली पकड़ने और तटीय नौकायन के लिए परिस्थितियां अनुकूल हैं।",
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
                "status_text_hi": "अपडेट रहें / निगरानी रखें",
                "farmer": {
                    "hi": "हल्की आंधी और बारिश की संभावना। खेतों में जल-निकासी की व्यवस्था रखें और खुले में कटी फसल न छोड़ें।",
                    "en": "Scattered showers and gusty winds expected. Ensure field drainage channels are clear and cover harvested produce."
                },
                "marine": {
                    "hi": "हवा की गति 25-40 किमी/घंटा संभव। मछुआरे तट के निकट सावधानी से नौकायन करें।",
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
                "status_text_hi": "सतर्क रहें / तैयार रहें",
                "farmer": {
                    "hi": "भारी बारिश और 45+ किमी/घंटा तेज हवा की चेतावनी! कीटनाशक छिड़काव और सिंचाई तुरंत रोकें, कटी फसल सुरक्षित गोदाम में रखें।",
                    "en": "Heavy rainfall and 45+ km/h squall alert! Suspend pesticide spraying and irrigation immediately; store produce in covered shelters."
                },
                "marine": {
                    "hi": "समुद्र अशांत (45-65 किमी/घंटा तेज हवा)। मछुआरे गहरे समुद्र में बिल्कुल न जाएं, नौकाएं सुरक्षित बांधें।",
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
                "status_text_hi": "तूफान चेतावनी / तत्काल कदम उठाएं",
                "farmer": {
                    "hi": "तूफान और अति-वृष्टि का गंभीर अलर्ट! तुरंत खेत खाली करें, पशुओं को पक्के बाड़ों में सुरक्षित बांधें, कोई कृषि कार्य न करें!",
                    "en": "SEVERE DISASTER / STORM ALERT! Evacuate open fields immediately, secure livestock in reinforced sheds, cease all agricultural operations!"
                },
                "marine": {
                    "hi": "गंभीर समुद्री चक्रवात/तूफान चेतावनी! सभी समुद्री गतिविधियां पूर्णतः स्थगित। तत्काल सुरक्षित आश्रय लें।",
                    "en": "CRITICAL MARINE WARNING / GALE CONDITIONS (>75 km/h). Complete suspension of all fishing and harbor activities. Seek immediate high-ground shelter."
                },
                "actions": [
                    "Evacuate low-lying flood-prone zones if instructed by authorities.",
                    "Stock emergency drinking water, dry rations, and first aid kits.",
                    "Do not step out during peak gale or torrential downpour."
                ]
            }
        }

    def _train_model(self):
        """Train Random Forest classifier on MoES meteorological thresholds."""
        X_train = np.array([
            [0, 10, 30], [5, 15, 28], [10, 18, 27],
            [20, 25, 26], [30, 30, 25], [45, 38, 24],
            [60, 45, 24], [80, 50, 22], [95, 60, 21],
            [120, 80, 20], [150, 100, 19], [180, 110, 18]
        ])
        # 0=GREEN, 1=YELLOW, 2=ORANGE, 3=RED
        y_train = np.array([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3])
        self.model.fit(X_train, y_train)

    def predict(self, rain_mm: float, wind_kmph: float, temp_c: float, city: str = "Your Area") -> Dict[str, Any]:
        """
        Run Random Forest prediction and return MoES IMD warning payload.
        """
        features = np.array([[float(rain_mm), float(wind_kmph), float(temp_c)]])
        pred_tier = int(self.model.predict(features)[0])

        # Enforce severe threshold overrides for extreme outliers
        if rain_mm >= 115.6 or wind_kmph >= 75 or temp_c >= 45 or temp_c <= 2:
            pred_tier = max(pred_tier, 3)
        elif rain_mm >= 64.5 or wind_kmph >= 45 or temp_c >= 40 or temp_c <= 4:
            pred_tier = max(pred_tier, 2)
        elif rain_mm >= 15.6 or wind_kmph >= 25:
            pred_tier = max(pred_tier, 1)

        info = self.alert_map[pred_tier]
        color = info["color"]
        risk = info["risk"]

        spoken_hi = f"सतर्क रहें। {city} के लिए मौसम विभाग का {color} अलर्ट। {info['farmer']['hi']}"
        spoken_en = f"IMD {color} Alert for {city}. Severe weather risk: {risk}. {info['farmer']['en']}"

        return {
            "city": city,
            "rain_mm": float(rain_mm),
            "wind_kmph": float(wind_kmph),
            "temp_c": float(temp_c),
            "imd_color_code": color,
            "risk_assessment": risk,
            "status_text": info["status_text"],
            "status_text_hi": info["status_text_hi"],
            "farmer_advisory": info["farmer"],
            "marine_advisory": info["marine"],
            "action_points": info["actions"],
            "spoken_text_hi": spoken_hi,
            "spoken_text_en": spoken_en,
            "audio_file": None
        }

# Singleton instance
disaster_predictor = MoESDisasterPredictor()
