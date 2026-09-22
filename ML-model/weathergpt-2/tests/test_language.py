from app.services.language import detect_language, language_display_name


def test_english_plain():
    assert detect_language("What is the weather in Lucknow tomorrow?") == "en"


def test_hindi_devanagari():
    assert detect_language("लखनऊ में कल मौसम कैसा रहेगा?") == "hi"


def test_tamil_script():
    assert detect_language("சென்னையில் நாளை வானிலை எப்படி இருக்கும்?") == "ta"


def test_kannada_script():
    assert detect_language("ಬೆಂಗಳೂರಿನಲ್ಲಿ ನಾಳೆಯ ಹವಾಮಾನ ಹೇಗಿರುತ್ತದೆ?") == "kn"


def test_marathi_marker():
    assert detect_language("लखनऊ में कल बारिश होगी क्या?") == "hi"
    # Explicit Marathi letter ळ should tip Devanagari toward Marathi
    assert detect_language("पुण्यात उद्या पाऊस पडेल का? वेळ चांगली आहे का?") == "mr"


def test_punjabi_gurmukhi():
    assert detect_language("ਅੱਜ ਅੰਮ੍ਰਿਤਸਰ ਵਿੱਚ ਮੌਸਮ ਕਿਵੇਂ ਹੈ?") == "pa"


def test_majority_english_mixed_prompt():
    # Mostly English with a few Hindi words → English (70% majority language)
    text = (
        "Please tell me the weather forecast for Lucknow for the next seven days "
        "and also क्या बारिश होगी"
    )
    assert detect_language(text) == "en"


def test_majority_indic_mixed_prompt():
    # Mostly Hindi with a short English fragment → Hindi (70% majority language)
    text = "लखनऊ में अगले सात दिनों का मौसम कैसा रहेगा please"
    assert detect_language(text) == "hi"


def test_majority_tamil_mixed_prompt():
    # Mostly Tamil with a short English word → Tamil
    text = "சென்னையில் நாளை வானிலை எப்படி இருக்கும் please"
    assert detect_language(text) == "ta"


def test_language_display_names():
    assert language_display_name("ta") == "Tamil"
    assert language_display_name("en") == "English"
