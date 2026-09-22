from app.services.followups import missing_info_follow_up, suggest_follow_ups


def test_advisory_follow_ups_english():
    questions = suggest_follow_ups("advisory_request", "en", "Lucknow", role="citizen")
    assert len(questions) == 3
    assert any("Lucknow" in q for q in questions)


def test_farmer_follow_ups_hindi():
    questions = suggest_follow_ups("harvest_decision", "hi", "Lucknow", role="farmer")
    assert len(questions) == 3
    assert any(any("\u0900" <= ch <= "\u097F" for ch in q) for q in questions)
    assert any("लखनऊ" in q for q in questions)
    assert all("Lucknow" not in q for q in questions)


def test_crop_missing_prompt_hindi():
    q = missing_info_follow_up("crop_type", "hi", "Lucknow")
    assert "फसल" in q
    assert "लखनऊ" in q
    assert "Lucknow" not in q


def test_english_crop_missing_prompt():
    q = missing_info_follow_up("crop_type", "en", "Lucknow")
    assert "crop" in q.lower()
